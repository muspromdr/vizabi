define([
    'jquery',
    'd3',
    'underscore',
    'base/utils',
    'base/class',
    'base/model',
    'base/events'
], function($, d3, _, utils, Class, Model, Events) {

    var class_loading = "vzb-loading";

    var Component = Class.extend({
        init: function(parent, options) {

            //properties in this component should be the ones in options,
            //unless they were already set by a child class
            _.extend(this, options, this);

            //default values,
            //in case there's none
            this.template_data = this.template_data || {
                name: this.name
            };
            this.components = this.components || [];
            this.components_config = this.components;
            this.profiles = this.profiles || {};
            this.parent = parent;
            this.events = new Events();

            var _this = this;
            this.model.on("change", function() {
                _this.update();
            })
        },

        //TODO: change the scary name! :D bootstrap is one good one
        render: function(callback) {
            var defer = $.Deferred();
            var _this = this;

            // First, we load the template
            var promise = this.loadTemplate();

            // After the template is loaded, check if postRender exists
            promise.then(function() {

                    // add css loading class to hide elements
                    if (_this.element) {
                        _this.element.classed(class_loading, true);
                    }

                    // attempt to execute callback
                    if (typeof callback === 'function') {
                        return callback();
                    }

                })
                // After load components
                .then(function() {
                    return _this.loadComponents();
                })
                // If there is no callback
                .then(function() {
                    return _this.execute(_this.postRender);
                })
                // After loading components, render them
                .then(function() {
                    //TODO: Chance of refactoring
                    //Every widget binds its resize function to the resize event
                    return _this.renderComponents();
                    _this.resize();
                })
                // After rendering the components, resolve the defer
                .done(function() {
                    //not loading anytmore, remove class
                    if (_this.element) {
                        _this.element.classed(class_loading, false);
                    }

                    defer.resolve();
                });

            return defer;
        },

        // Execute function if it exists, with promise support
        execute: function(func) {
            var defer = $.Deferred(),
                possiblePromise;

            // only try to execute if it is a function
            if (_.isFunction(func)) {
                possiblePromise = func.apply(this);
            };

            // if a promise is returned, solve it when its done
            if (possiblePromise && _.isFunction(possiblePromise.then)) {
                possiblePromise.done(function() {
                    defer.resolve();
                });
            }
            // if no promise is returned, resolve right away
            else {
                defer.resolve();
            }

            return defer;
        },

        loadComponents: function() {
            var defer = $.Deferred(),
                _this = this,
                promises = [],
                components = this.components;

            //save initial config
            this.components_config = _.map(components, _.clone);
            //use the same name for the initialized collection           
            this.components = {};

            // Loops through components, loading them.
            _.each(components, function(component) {
                var promise = _this.loadComponent(component);
                promises.push(promise);
            });

            // When all components have been loaded, resolve the defer
            $.when.apply(null, promises).done(function() {
                defer.resolve();
            });

            return defer;
        },

        loadComponent: function(component) {

            if (!component.component || !component.placeholder) {
                console.log("Error loading component");
                return true;
            }

            //name and path
            var _this = this,
                defer = $.Deferred(),
                path = component.component,
                name_token = path.split("/"),
                name = name_token[name_token.length - 1],
                id = name,
                component_path = "components/" + path + "/" + name,
                component_model;

            //component model mapping
            component_model = this._modelMapping(component.model);

            //component options
            var options = _.extend(component, {
                name: name,
                model: component_model
            });

            // Loads the file we need
            require([component_path], function(subcomponent) {
                //initialize subcomponent
                _this.components[id] = new subcomponent(_this, options);
                defer.resolve();
            });

            return defer;
        },

        renderComponents: function() {
            var defer = $.Deferred(),
                promises = [];

            // Loops through components, rendering them.
            _.each(this.components, function(component) {
                promises.push(component.render());
            });

            // After all components are rendered, resolve the defer
            $.when.apply(null, promises).done(function() {
                defer.resolve();
            });

            return defer;
        },

        loadTemplate: function() {
            var _this = this;
            var defer = $.Deferred();

            this.template_data = _.extend(this.template_data, {
                t: this.getTFunction()
            })

            if (this.template) {
                //require the template file
                require(["text!" + this.template + ".html"], function(html) {
                    //render template using underscore
                    var rendered = _.template(html, _this.template_data);

                    var root = _this.parent.element || d3;
                    //place the contents into the correct placeholder
                    _this.placeholder = (_.isString(_this.placeholder)) ? root.select(_this.placeholder) : _this.placeholder;
                    _this.placeholder.html(rendered);

                    //TODO: refactor the way we select the first child
                    //define this element inside the placeholder
                    try {
                        _this.element = utils.jQueryToD3(
                            utils.d3ToJquery(_this.placeholder).children().first()
                        );
                    } catch (err) {
                        console.error("Placeholder div not found! Check the name of the placeholder for the component " + this.template);
                        console.error(err);
                    }

                    //Resolve defer
                    defer.resolve();
                });

            } else {
                defer.resolve();
            }

            return defer;
        },

        //TODO: remove this method - It's just wrapping an already
        //existing model method
        setState: function(state) {
            this.model.setState(state);
        },

        postRender: function() {},

        // Component-level update updates the sub-components
        update: function() {
            for (var i in this.components) {
                if (this.components.hasOwnProperty(i)) {
                    this.components[i].update();
                }
            }
        },

        //what to do when page is resized
        resize: function() {},

        reassignModel: function() {
            //only reassign if it's loaded already
            if (_.isArray(this.components)) return;

            var _this = this;
            //for each subcomponent, reassign model
            for (var i in this.components_config) {
                var c = this.components_config[i],
                    name_token = c.component.split("/"),
                    id = name_token[name_token.length - 1],
                    model = this._modelMapping(c.model);

                if (model) {
                    model.on("change", function() {
                        _this.components[id].update();
                    });
                    this.components[id].model = model;
                    this.components[id].reassignModel();
                }
            }
        },

        //maps the current model to subcomponents
        //model_config may be array or string
        _modelMapping: function(model_config) {

            if (_.isUndefined(model_config)) {
                return;
            }

            if (_.isArray(model_config) && model_config.length > 1) {
                var values = {};
                for (var i = 0, size = component.model.length; i < size; i++) {
                    values[i] = this.model.get(i);
                }
                return new Model(values);
            } else if (_.isArray(model_config) && model_config.length == 1) {
                return this.model.get(model_config[0]);
            } else if (_.isString(model_config) && model_config.length > 0) {
                return this.model.get(model_config);
            } else {
                return new Model({});
            }

        },

        getInstance: function(manager) {
            return this.parent.getInstance(manager);
        },

        getLayoutProfile: function() {
            //get profile from parent if layout is not available
            if (this.layout) {
                return this.layout.currentProfile();
            } else {
                return this.parent.getLayoutProfile();
            }
        },

        addComponent: function(path, options) {
            if (_.isUndefined(this.components)) this.components = [];
            var name_token = path.split("/"),
                name = name_token[name_token.length - 1];

            this.components.push({
                name: name,
                path: path,
                options: options
            });
        },

        getUIString: function(string) {
            var lang = this.model.get("language");
            var ui_strings = this.model.get("ui_strings");

            if (ui_strings && ui_strings.hasOwnProperty(lang) && ui_strings[lang].hasOwnProperty(string)) {
                return ui_strings[lang][string];
            } else {
                return string;
            }
        },

        getTFunction: function() {
            var lang = this.model.get("language");
            var ui_strings = this.model.get("ui_strings");

            return function(string) {
                if (ui_strings && ui_strings.hasOwnProperty(lang) && ui_strings[lang].hasOwnProperty(string)) {
                    return ui_strings[lang][string];
                } else {
                    return string;
                }
            }
        }

    });


    return Component;
});