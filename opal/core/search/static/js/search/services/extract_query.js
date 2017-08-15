angular.module('opal.services').factory('ExtractQuery', function(){
  var baseModel = {
    column     : null,
    field      : null,
    queryType  : null,
    query      : null
  };

  var ExtractQuery = function(anyOrAll){
    // the seatch query
    this.criteria = [_.clone(baseModel)];

    // whether the user would like an 'or' conjunction or and 'and'
    this.anyOrAll = anyOrAll;

    // the search fields
    this.fields = [];
  };

  ExtractQuery.prototype = {
    addField: function(someField){
      // add a field to the fields
      this.fields.push(someField);
    },
    removeField: function(someField){
    },
    readableQueryType: function(someQuery){
      if(!someQuery){
        return someQuery;
      }
      var result = someQuery;
      if(someQuery === "Equals"){
        result = "is";
      }
      if(someQuery === "Before" || someQuery === "After"){
        result = "is " + result;
      }
      if(someQuery === "All Of" || someQuery === "Any Of"){
        result = "is"
      }

      return result.toLowerCase();
    },

    completeCriteria: function(){
      var combine;
      // queries can look at either all of the options, or any of them
      // ie 'and' conjunctions or 'or'
      if(this.anyOrAll === 'all'){
        combine = "and";
      }
      else{
        combine = 'or';
      }

      // remove incomplete criteria
      var criteria = _.filter(this.criteria, function(c){
          // Ensure we have a query otherwise
          if(c.column &&  c.field &&  c.query){
              return true;
          }
          c.combine = combine;
          // If not, we ignore this clause
          return false;
      });

      _.each(criteria, function(c){
        c.combine = combine;
      });

      return criteria
    },
    addFilter: function(){
        this.criteria.push(_.clone(baseModel));
    },
    removeFilter: function(index){
        if(this.selectedInfo === this.criteria[index]){
          this.selectedInfo = undefined;
        }
        if(this.criteria.length == 1){
            this.removeCriteria();
        }
        else{
            this.criteria.splice(index, 1);
        }
    },
    resetFilter: function(queryRow, fieldsTypes){
      // when we change the column, reset the rest of the query
      _.each(queryRow, function(v, k){
        if(!_.contains(fieldsTypes, k) && k in baseModel){
          queryRow[k] = baseModel[k];
        }
      });
    },
    removeCriteria: function(){
        this.criteria = [_.clone(baseModel)];
    }
  }

  return ExtractQuery;
});