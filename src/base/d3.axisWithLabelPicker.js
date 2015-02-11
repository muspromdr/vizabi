define(['d3'], function(d3){

    d3.svg.axisSmart = function(){
        var VERTICAL = 'vertical axis';
        var HORIZONTAL = 'horizontal axis';
        var OPTIMISTIC = 'optimistic approximation: labels have different lengths';
        var PESSIMISTIC = 'pessimistic approximation: all labels have the largest length';
        var DEFAULT_LOGBASE = 10;

        var _super = d3.svg.axis();
        _super.smartLabeler = function(options){
            var axis = this;
            this.METHOD_REPEATING = 'repeating specified powers';
            this.METHOD_DOUBLING = 'doubling the value';

            if(options==null) options = {}
            if(options.scaleType==null) {console.warn('please set scaleType to "lin", "log", "ordinal"'); return axis;};
            if(options.scaleType=='ordinal') return axis.tickValues(null);

            if(options.logBase==null) options.logBase = DEFAULT_LOGBASE;
            if(options.method==null) options.method = this.METHOD_REPEATING;
            if(options.baseValues==null) options.stops = [1,2,5,3,7,4,6,8,9];
            if(options.doublingOriginAtFraction==null) options.doublingOriginAtFraction = 0.5;
            if(options.pivotingLimit==null) options.pivotingLimit = 44;
            if(options.isPivotAuto==null) options.isPivotAuto = true;
            if(options.removeAllLabels==null) options.removeAllLabels = false;

            if(options.formatterRemovePrefix==null) options.formatterRemovePrefix = false;

            if(options.formatter==null) options.formatter = function(d){
                var format = "f";
                var prec = 0;
                if(Math.abs(d)<1) {prec = 1; format = "r"};

                var prefix = "";
                if(options.formatterRemovePrefix) return d3.format("."+prec+format)(d);

                switch (Math.floor(Math.log10(Math.abs(d)))){
                    case -13: d = d*1000000000000; prefix = "p"; break; //0.1p
                    case -10: d = d*1000000000; prefix = "n"; break; //0.1n
                    case  -7: d = d*1000000; prefix = "µ"; break; //0.1µ
                    case  -6: d = d*1000000; prefix = "µ"; break; //1µ
                    case  -5: d = d*1000000; prefix = "µ"; break; //10µ
                    case  -4: break; //0.0001
                    case  -3: break; //0.001
                    case  -2: break; //0.01
                    case  -1: break; //0.1
                    case   0: break; //1
                    case   1: break; //10
                    case   2: break; //100
                    case   3: break; //1000
                    case   4: break; //10000
                    case   5: d = d/1000000; prefix = "M"; prec = 1; break; //0.1M
                    case   6: d = d/1000000; prefix = "M"; break; //1M
                    case   7: d = d/1000000; prefix = "M"; break; //10M
                    case   8: d = d/1000000; prefix = "M"; break; //100M
                    case   9: d = d/1000000000; prefix = "B"; break; //1B
                    case  10: d = d/1000000000; prefix = "B"; break; //10B
                    case  11: d = d/1000000000; prefix = "B"; break; //100B
                    //use the D3 SI formatting for the extreme cases
                    default: return (d3.format("."+prec+"s")(d)).replace("G","B");
                }


                // use manual formatting for the cases above
                return (d3.format("."+prec+format)(d)+prefix).replace("G","B");
            }
            if(options.cssMarginLeft==null||parseInt(options.cssMarginLeft)<0) options.cssMarginLeft = "5px";
            if(options.cssMarginRight==null||parseInt(options.cssMarginRight)<0) options.cssMarginRight = "5px";
            if(options.cssMarginTop==null||parseInt(options.cssMarginTop)<0) options.cssMarginTop = "5px";
            if(options.cssMarginBottom==null||parseInt(options.cssMarginBottom)<0) options.cssMarginBottom = "5px";
            if(options.toolMargin==null) options.toolMargin = {left: 5, bottom: 5, right: 5, top: 5};

            if(options.tickSpacing==null)options.tickSpacing = 50;
            if(options.showOuter==null)options.showOuter = false;
            if(options.limitMaxTickNumber==null)options.limitMaxTickNumber = 10;

            var orient = this.orient()=="top"||this.orient()=="bottom"?HORIZONTAL:VERTICAL;

            if(options.cssFontSize==null) options.cssFontSize = "13px";
            if(options.widthToFontsizeRatio==null) options.widthToFontsizeRatio = 0.75;
            if(options.heightToFontsizeRatio==null) options.heightToFontsizeRatio = 1.20;
            if(options.widthOfOneDigit==null) options.widthOfOneDigit =
                parseInt(options.cssFontSize)*options.widthToFontsizeRatio;
            if(options.heightOfOneDigit==null) options.heightOfOneDigit =
                parseInt(options.cssFontSize)*options.heightToFontsizeRatio;

            
            
            var domain = axis.scale().domain();
            var range = axis.scale().range()
            var min = d3.min([domain[0],domain[domain.length-1]]);
            var max = d3.max([domain[0],domain[domain.length-1]]);
            
            
            
            // estimate the longest formatted label in pixels
            var estLongestLabelLength =
                //take 17 sample values and measure the longest formatted label
                d3.max( d3.range(min, max, (max-min)/17).concat(max).map(function(d){return options.formatter(d).length}) ) 
                * options.widthOfOneDigit
                + parseInt(options.cssMarginLeft);

            axis.pivot = options.isPivotAuto 
                && (
                    (estLongestLabelLength + axis.tickPadding() + axis.tickSize() > options.pivotingLimit)
                    && (orient == VERTICAL)
                    ||
                    !(estLongestLabelLength + axis.tickPadding() + axis.tickSize() > options.pivotingLimit)
                    && !(orient == VERTICAL)
                );
            
            var labelsStackOnTop = (orient==HORIZONTAL && axis.pivot || orient==VERTICAL && !axis.pivot);
            
            
            
            
            // conditions to remove labels altogether
            if(!labelsStackOnTop && options.heightOfOneDigit > options.pivotingLimit) return axis.tickValues([]);
            if(options.removeAllLabels) return axis.tickValues([]);
            
            // return a single tick if have only one point in the domain
            if (min==max) return axis.tickValues([min]).ticks(1).tickFormat(options.formatter);


            var ticksNumber = 5;
            var tickValues = [];
            var lengthDomain = Math.abs(domain[domain.length-1] - domain[0]);
            var lengthRange = Math.abs(range[range.length-1] - range[0]);


            console.log("********** "+orient+" **********");
            console.log("min max ", min, max);
            console.log("w h of one digit " + options.widthOfOneDigit + " " + options.heightOfOneDigit);
            


            var getBaseLog = function(x, base) {
                if(base == null) base = options.logBase;
                return Math.log(x) / Math.log(base);
            };

            var onlyUnique = function(value, index, self) {
                return self.indexOf(value) === index;
            }

            
            var labelsFitIntoScale = function(tickValues, lengthRange, approximationStyle){
                if (approximationStyle==null) approximationStyle = PESSIMISTIC;
                
                if(labelsStackOnTop){
                    //labels stack on top of each other. digit height matters
                    return lengthRange >
                        tickValues.length * (
                            options.heightOfOneDigit +
                            parseInt(options.cssMarginTop) +
                            parseInt(options.cssMarginBottom)
                        );
                }else{
                    //labels stack side by side. label width matters
                    return lengthRange >
                        tickValues.length * (
                            parseInt(options.cssMarginLeft) +
                            parseInt(options.cssMarginRight) 
                        )
                        + (approximationStyle == PESSIMISTIC ?
                            options.widthOfOneDigit *
                            tickValues.length * d3.max(tickValues.map(function(d){return options.formatter(d).length}))
                            : 0)
                        + (approximationStyle == OPTIMISTIC ?
                            options.widthOfOneDigit * (
                            tickValues.map(function(d){return options.formatter(d)}).join("").length
                            )
                            : 0);
                }
            }
            
            
            
            
            
            var collisionBetween = function(one, two){
                if(two==null || two.length == 0) return false;
                if(!(two instanceof Array))two = [two];
            
                for(var i = 0; i<two.length; i++){
                    if( 
                        one != two[i] && one != 0
                        &&
                        Math.abs(axis.scale()(one) - axis.scale()(two[i]))
                        <
                        (labelsStackOnTop? 
                            (options.heightOfOneDigit)
                            :
                            (options.formatter(one).length+options.formatter(two[i]).length)*options.widthOfOneDigit/2
                        )
                    ) return true; 
                
                }
                return false;
            }

            

            


            if(options.scaleType=="genericLog"){
                var eps = axis.scale().eps();
                var delta = axis.scale().delta();
                var bothSidesUsed = (min<0 && max >0);

                if(options.showOuter)tickValues.push(max);
                if(options.showOuter)tickValues.push(min);

                if(options.method == this.METHOD_REPEATING){
                    
                    var spawnZero = bothSidesUsed? [0]:[];

                    // check if spawn positive is needed. if yes then spawn!
                    var spawnPos = max<eps? [] : (
                        d3.range(
                            Math.floor(getBaseLog(Math.max(eps,min))),
                            Math.ceil(getBaseLog(max)),
                            1)
                        .concat(Math.ceil(getBaseLog(max)))
                        .map(function(d){return Math.pow(options.logBase, d)})
                        );

                    // check if spawn negative is needed. if yes then spawn!
                    var spawnNeg = min>-eps? [] : (
                        d3.range(
                            Math.floor(getBaseLog(Math.max(eps,-max))),
                            Math.ceil(getBaseLog(-min)),
                        1)
                        .concat(Math.ceil(getBaseLog(-min)))
                        .map(function(d){return -Math.pow(options.logBase, d)})
                        );
                    
                    
                    var spawn = groupByPriorities( spawnZero.concat(spawnPos).concat(spawnNeg).sort(d3.ascending) );
                    var avoidCollidingWith = spawnZero.concat(tickValues);

                    options.stops.forEach(function(stop, i){
                        if(i==0){
                            for(var j = 0; j<spawn.length; j++){
                                
                                // compose an attempt to add more axis labels    
                                var trytofit = tickValues
                                    .concat(spawn[j].map(function(d){return d*stop}))
                                    // throw away labels that collide with "special" labels 0, min, max
                                    .filter(function(d){return !collisionBetween(d,avoidCollidingWith);})
                                    .filter(function(d){return min<=d&&d<=max})
                                    .filter(onlyUnique);
                                
                                // stop populating if labels don't fit 
                                if(!labelsFitIntoScale(trytofit, lengthRange, OPTIMISTIC)) break;
                                
                                // apply changes if no blocking instructions
                                tickValues = trytofit;
                            }
                            
                            //flatten the spawn array
                            spawn = [].concat.apply([], spawn);
                        }else{
                            // compose an attempt to add more axis labels
                            var trytofit = tickValues
                                .concat(spawn.map(function(d){return d*stop}))
                                .filter(function(d){return min<=d&&d<=max})
                                .filter(onlyUnique);
                            
                            // stop populating if the new composition doesn't fit
                            if(!labelsFitIntoScale(trytofit, lengthRange)) return;
                            // stop populating if the number of labels is limited in options
                            if(tickValues.length > options.limitMaxTickNumber && options.limitMaxTickNumber!=0) return;
                            
                            // apply changes if no blocking instructions
                            tickValues = trytofit;
                        }
                    })


                }else if(options.method == this.METHOD_DOUBLING) {
                    var doublingLabels = [];
                    tickValues = tickValues.concat(bothSidesUsed? [0]:[]);
                    var avoidCollidingWith = tickValues;

                    var startPos = max<eps? null :
                    Math.pow(options.logBase,  Math.floor(
                        (Math.ceil(
                            getBaseLog(max) + Math.ceil(getBaseLog(Math.max(eps,min)))*options.doublingOriginAtFraction
                        ))
                        
                    ) )

                    var startNeg = min>-eps? null :
                    - Math.pow(options.logBase,  Math.floor(
                        (Math.ceil(
                            getBaseLog(-min) + Math.ceil(getBaseLog(Math.max(eps,-max)))*options.doublingOriginAtFraction
                        ))
                    ) )

//                    var startPos = max<eps? null : Math.pow(options.logBase, Math.ceil(getBaseLog(max)));
//                    var startNeg = min>-eps? null : -Math.pow(options.logBase, Math.ceil(getBaseLog(-min)));
//                    var startPos = max<eps? null : Math.pow(options.logBase, Math.floor(getBaseLog(Math.max(eps,min))));
//                    var startNeg = min>-eps? null : -Math.pow(options.logBase, Math.floor(getBaseLog(Math.max(eps,-max))));
  
                    

                    if(startPos){ for(var l=startPos; l<=max; l*=2) doublingLabels.push(l);}
                    if(startPos){ for(var l=startPos/2; l>Math.max(min,eps); l/=2) doublingLabels.push(l);}
                    if(startNeg){ for(var l=startNeg; l>=min; l*=2) doublingLabels.push(l);}
                    if(startNeg){ for(var l=startNeg/2; l<Math.min(max,-eps); l/=2) doublingLabels.push(l);}
                                        
                    doublingLabels = doublingLabels
                        .sort(d3.ascending)
                        .filter(function(d){return min<=d&&d<=max}) 
                    
                    doublingLabels = groupByPriorities(doublingLabels,false); // don't skip taken values
                    
                    var tickValues_1 = tickValues;
                    for(var j = 0; j<doublingLabels.length; j++){

                        // compose an attempt to add more axis labels    
                        var trytofit = tickValues_1.concat(doublingLabels[j])
                            .filter(function(d){ return !collisionBetween(d,avoidCollidingWith); })
                            .filter(onlyUnique)
                        
                        // stop populating if labels don't fit 
                        if(!labelsFitIntoScale(trytofit, lengthRange, PESSIMISTIC)) break;
                        
                        // apply changes if no blocking instructions
                        tickValues = trytofit
                    }


                }
                
                
                if(tickValues.length==0)tickValues = [min, max];
            } //logarithmic

            
            
            
            if(options.scaleType=="linear"){
                tickValues = null;
                ticksNumber = Math.max(lengthRange / options.tickSpacing, 2);
            }



            
            if(tickValues!=null) tickValues.sort(function(a,b){return axis.scale()(b) - axis.scale()(a)});
            axis.repositionLabels = repositionLabelsThatStickOut(tickValues, options, orient, axis.scale(), axis.pivot);

console.log("final result",tickValues);
            
            return axis
                .ticks(ticksNumber)
                .tickFormat(options.formatter)
                .tickValues(tickValues);
        };

        
        
        
        // GROUP ELEMENTS OF AN ARRAY, SO THAT...
        // less-prio elements are between the high-prio elements
        // Purpose: enable adding axis labels incrementally, like this for 9 labels:
        // PRIO 1: +--------, concat result: +-------- first we show only 1 label
        // PRIO 2: ----+---+, concat result: +---+---+ then we add 2 more, that are maximally spaced
        // PRIO 3: --+---+--, concat result: +-+-+-+-+ then we fill spaces with 2 more labels
        // PRIO 4: -+-+-+-+-, concat result: +++++++++ then we fill the remaing spaces and show all labels
        // exception: zero jumps to the front, if it's on the list
        // example1: [1 2 3 4 5 6 7] --> [[1][4 7][2 3 5 6]]
        // example2: [1 2 3 4 5 6 7 8 9] --> [[1][5 9][3 7][2 4 6 8]]
        // example3: [-4 -3 -2 -1 0 1 2 3 4 5 6 7] --> [[0][-4][2][-1 5][-3 -2 1 3 4 6 7]]
        // returns the nested array
        function groupByPriorities(array, removeDuplicates){
            if(removeDuplicates==null) removeDuplicates = true;

            var result = [];
            var taken = [];

            //zero is an exception, if it's present we manually take it to the front
            if(array.indexOf(0)!=-1){
                result.push([0]);
                taken.push(array.indexOf(0));
            }

            for(var k = array.length; k>=1; k/=2){
                // push the next group of elements to the result
                result.push(array.filter(function(d,i){
                    if(i % Math.floor(k) == 0 && (taken.indexOf(i)==-1 || !removeDuplicates)){
                        taken.push(i);
                        return true;
                    }
                    return false;
                }));
            }

            return result;
        }        
        
        
        
        
        
        
        
        
        // REPOSITION LABELS THAT STICK OUT
        // Purpose: the outer labels can easily be so large, they stick out of the allotted area
        // Example:
        // Label is fine:    Label sticks out:    Label sticks out more:    Solution - label is shifted:
        //      12345 |           1234|                123|5                   12345|          
        // _______.   |      _______. |           _______.|                 _______.|          
        // 
        // this is what the function does on the first step (only outer labels)
        // on the second step it shifts the inner labels that start to overlap with the shifted outer labels
        // 
        // requires tickValues array to be sorted from tail-first
        // tail means left or bottom, head means top or right
        //
        // returns the array of recommended {x,y} shifts
        
        function repositionLabelsThatStickOut(tickValues, options, orient, scale, pivot){
            if(tickValues==null)return null;
                
            // make an abstraction layer for margin sizes
            // tail means left or bottom, head means top or right
            var margin = 
                orient==VERTICAL?
                {head: options.toolMargin.top, tail: options.toolMargin.bottom}
                :
                {head: options.toolMargin.right, tail: options.toolMargin.left};
            
            // check which dimension requires shifting
            // X if labels stack side by side, Y if labels stack on top of one another
            var dimension = (pivot&&orient==VERTICAL || !pivot&&orient==HORIZONTAL)? "x":"y";
            
            var result = {};
                        
               
            // STEP 1:
            // for outer labels: avoid sticking out from the tool margin
            tickValues.forEach(function(d,i){
                if(i!=0 && i!=tickValues.length-1) return;
                
                // compute the influence of the axis head
                var repositionHead = margin.head
                    + (orient==HORIZONTAL?1:0) * d3.max(scale.range()) 
                    + (orient==HORIZONTAL?-1:1) * scale(d)
                    - (dimension=="x") * options.formatter(d).length * options.widthOfOneDigit / 2
                    - (dimension=="y") * options.heightOfOneDigit / 2
                    // we may consider or not the label margins to give them a bit of spacing from the edges
                    //- (dimension=="x") * parseInt(options.cssMarginRight);
                    //- (dimension=="y") * parseInt(options.cssMarginTop);
                
                // compute the influence of the axis tail
                var repositionTail = Math.min(margin.tail, options.widthOfOneDigit)
                    + (orient==VERTICAL?1:0) * d3.max(scale.range()) 
                    + (orient==VERTICAL?-1:1) * scale(d)
                    - (dimension=="x") * options.formatter(d).length * options.widthOfOneDigit / 2
                    - (dimension=="y") * options.heightOfOneDigit / 2
                    // we may consider or not the label margins to give them a bit of spacing from the edges
                    //- (dimension=="x") * parseInt(options.cssMarginLeft);
                    //- (dimension=="y") * parseInt(options.cssMarginBottom);
                
                // apply limits in order to cancel repositioning of labels that are good
                if(repositionHead>0)repositionHead=0;
                if(repositionTail>0)repositionTail=0;
                
                // add them up with appropriate signs, save to the axis
                result[i] = {x:0, y:0};
                result[i][dimension] = (dimension=="y"?-1:1) * (repositionHead - repositionTail);
            });
            

            // STEP 2:
            // for inner labels: avoid collision with outer labels
            tickValues.forEach(function(d,i){
                if(i==0 || i==tickValues.length-1) return;
                
                // compute the influence of the head-side outer label
                var repositionHead = 
                    Math.abs(scale(d) 
                        - scale(tickValues[tickValues.length-1]) 
                        + result[tickValues.length-1][dimension]
                    )
                    - (dimension=="x") * options.widthOfOneDigit / 2 
                        * options.formatter(d).length
                    - (dimension=="x") * options.widthOfOneDigit / 2 
                        * options.formatter(tickValues[tickValues.length-1]).length
                    - (dimension=="y") * options.heightOfOneDigit 
                        * 0.7;

                // compute the influence of the tail-side outer label
                var repositionTail = 
                    Math.abs(scale(d) 
                        - scale(tickValues[0]) 
                        + result[0][dimension]
                    )
                    - (dimension=="x") * options.widthOfOneDigit / 2 
                        * options.formatter(d).length
                    - (dimension=="x") * options.widthOfOneDigit / 2 
                        * options.formatter(tickValues[0]).length
                    - (dimension=="y") * options.heightOfOneDigit 
                        0.7;
                
                // apply limits in order to cancel repositioning of labels that are good
                if(repositionHead>0)repositionHead=0;
                if(repositionTail>0)repositionTail=0;
                
                // add them up with appropriate signs, save to the axis
                result[i] = {x:0, y:0};
                result[i][dimension] = (dimension=="y"?-1:1) * (repositionHead - repositionTail);
            });
            
            
            return result;
        } // function repositionLabelsThatStickOut()
        
        
        
        
        

        return _super;
    }; //d3.svg.axisSmart = function(){

}); //define(['d3'], function(d3){
