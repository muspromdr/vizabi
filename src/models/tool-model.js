define([
    'jquery',
    'underscore',
    'base/utils',
    'base/model',
    'base/intervals',
    'models/data-model',
    'models/language-model',
    'models/time-model'
], function($, _, utils, Model, Intervals, DataModel, LanguageModel, TimeModel) {

    var ToolModel = Model.extend({
        init: function(options) {
            //all intervals are managed at tool level
            this._intervals = new Intervals();

            /*
             * Instantiation of SubModels
             */
            //these submodels are automatically instantiated (in options)
            this._default_models = ["state", "language", "data", "bind"];

            //generate model config and instantiate tool model
            var config = this._generateModelConfig(options);
            this._super(config);

            // todo: this is too specific and hardcoded
            // data needs to grab queries and 
            if (this.get("data") && typeof options.query === "function") {
                this.set("data.query", options.query(this), true);
                if(this.get("language")) {
                    this.set("data.language", this.get("language.value"), true);
                }
            }

            /*
             * Validation
             */

            //generate validation function
            this.validate = this._generateValidate(options.validate);
            this.validate();

            /*
             * Binding Events
             */

            //bind external events
            this.bindEvents(options.bind);
        },

        /* ==========================
         * Loading and resetting
         * ==========================
         */

        //load method (hotfix)
        //TODO: improve the whole loading logic. It should load, then render
        load: function() {
            var _this = this,
                defer = $.Deferred(),
                promises = [],
                submodels = this.get();

            //load each submodel
            for (var i = 0; i < submodels.length; i++) {
                var submodel = submodels[i];
                if (submodel.load) {
                    promises.push(submodel.load());
                }
            };

            $.when.apply(null, promises).then(function() {
                _this.validate();
                defer.resolve();
            });

            return defer;
        },

        reset: function(new_options, silent) {
            var model_config = this._generateModelConfig(new_options);
            this._super(model_config, silent);
            //rebind events
            this.bindEvents(new_options.bind);
        },

        /* ==========================
         * Binding and propagation
         * ==========================
         */

        bindEvents: function(evts) {
            var _this = this;
            for (var i in evts) {
                _this.on(i, evts[i]);
            }
        },

        //propagate option changes to model
        //todo: improve propagation of models
        propagate: function(options, silent) {
            //state properties
            if (options.state) {
                for (var i in options.state) {
                    this.get(i).set(options.state[i], silent);
                }
            }
            //bind properties
            if (options.bind) {
                this.get("bind").set(options.bind);
            }
            //binding
        },

        /* ==========================
         * Model instantiation
         * ==========================
         */

        _generateModelConfig: function(options) {

            var model_config = {},
                _this = this;

            //generate submodels for each default submodel defined in init
            var default_models = this._default_models;
            for (var i = 0, size = default_models.length; i < size; i++) {
                var m = default_models[i];
                model_config[m] = this._generateModel(m, options[m]);
                model_config[m].on("change", this._subModelOnChange(m));
            }

            //include a model for each property in the state and bind
            for (var i in options.state) {
                //naming convention: underscore -> time, time_2, time_overlay
                var name = i.split("_")[0]
                model_config[i] = this._generateModel(name, options.state[i]);
                model_config[i].on("change", _this._subStateOnChange(i));
            }

            return model_config;
        },

        //generate model
        _generateModel: function(model_name, values) {
            //todo: possible improvement (load via require)
            var available_models = {
                    data: DataModel,
                    language: LanguageModel,
                    time: TimeModel
                },
                model;
            //use specific model if it exists
            if (available_models.hasOwnProperty(model_name)) {
                model = new available_models[model_name](values, this._intervals);
            } else {
                model = new Model(values, this._intervals);
            }
            return model;

        },

        _subModelOnChange: function(submodel) {
            var _this = this;
            return function(evt, new_values) {
                _this.trigger("change:" + submodel, new_values);
            }
        },

        _subStateOnChange: function(substate) {
            var _this = this;
            return function(evt, new_values) {
                _this.validate();
                _this.get("state").set(substate, new_values, false, true);
                _this.trigger("change:state:" + substate, new_values);
            };
        },

        /* ==========================
         * Validation methods
         * ==========================
         */

        _generateValidate: function(validate) {
            /*
             * Function format
             * validate = function(model) {
             *     //change model
             *     //return model if changes were made
             *     //return false if no changes were made
             * }
             */

            if (typeof validate === 'function') {
                var _this = this;
                return function() {
                    while (validate(_this));
                    return;
                }
            }
            /*
             * Rules format
             * validate = [
             *     ["time.start", "=", "data.show.time_start"],
             *     ["time.end", "=", "data.show.time_end"],
             *     ["data.selected.time", "=", "time.value"]
             * ];
             */
            else {
                return this._parseValidate(validate);
            }
        },

        _parseValidate: function(validate) {
            if (!validate || validate.length === 0) {
                this.validate; //return generic model validation
            }

            var val_functions = [];
            for (var i = 0, size = validate.length; i < size; i++) {
                var rule = validate[i];
                if (rule.length !== 3) {
                    console.log("State validation format error: Rule " + i + ". Skipping...");
                    continue;
                }

                //rule is of the format [operand1, sign, operand2]
                //operand is a chain defined by a string: "model1.part.value"
                var v1 = rule[0].split("."), //split parts by "."
                    m1 = this.get(v1.shift()), //model is first part before "."
                    v1 = v1.join("."), //value is the rest, next parts
                    v2 = rule[2].split("."),
                    m2 = this.get(v2.shift()),
                    v2 = v2.join("."),
                    sign = rule[1]; //sign

                //generate validation for a single rule
                var evaluate = this._generateValidateRule(m1, v1, sign, m2, v2);
                val_functions.push(evaluate);
            };

            var validate_loop = false;
            //validate is the execution of each rule
            return function validate(silent) {
                //avoid validation loop
                if (validate_loop) {
                    validate_loop = false;
                    return;
                }
                validate_loop = true;
                for (var i = 0; i < val_functions.length; i++) {
                    val_functions[i](silent);
                };
            }
        },

        //arguments: model1, value1, sign, model2, value2:
        //example: 'time', 'value', '=', 'time_2', 'value'
        _generateValidateRule: function(m1, v1, sign, m2, v2) {
            var rule = function() {};
            switch (sign) {
                case '>':
                    rule = function(silent) {
                        if (m1.get(v1) <= m2.get(v2)) {
                            m1.set(v1, m2.get(v2) + 1, silent);
                        }
                    };
                    break;
                case '<':
                    rule = function(silent) {
                        if (m1.get(v1) >= m2.get(v2)) {
                            m1.set(v1, m2.get(v2) - 1, silent);
                        }
                    };
                    break;
                case '>=':
                    rule = function(silent) {
                        if (m1.get(v1) < m2.get(v2)) {
                            m1.set(v1, m2.get(v2), silent);
                        }
                    };
                    break;
                case '<=':
                    rule = function(silent) {
                        if (m1.get(v1) > m2.get(v2)) {
                            m1.set(v1, m2.get(v2), silent);
                        }
                    };
                    break;
                case '=':
                default:
                    rule = function(silent) {
                        if (m1.get(v1) != m2.get(v2)) {
                            m1.set(v1, m2.get(v2), silent);
                        }
                    };
                    break;
            }
            return rule;
        }

    });

    return ToolModel;
});