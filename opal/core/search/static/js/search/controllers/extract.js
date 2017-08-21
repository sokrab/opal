angular.module('opal.controllers').controller( 'ExtractCtrl',
  function(
    $scope, $http, $window, $modal, $timeout, PatientSummary, Paginator,
    referencedata, ngProgressLite, profile, filters, extractSchema, ExtractQuery
  ){
    "use strict";

    $scope.profile = profile;
    $scope.limit = 10;
    $scope.JSON = window.JSON;
    $scope.filters = filters;
    // $scope.columns = extractSchema.getAdvancedSearchColumns();
    $scope.extractSchema = extractSchema;
    // used by the download extract
    // a slice is a cut of data, a field that we want to download
    $scope.selectSliceSubrecord = function(sliceSubrecord){
      $scope.sliceSubrecord = sliceSubrecord;
    }
    $scope.setFieldInfo = function(field){
      $scope.fieldInfo = field
    }

    $scope.searched = false;
    $scope.currentPageNumber = 1;
    $scope.paginator = new Paginator($scope.search);
    $scope.state = 'query';

    _.extend($scope, referencedata.toLookuplists());

    $scope.extractQuery = new ExtractQuery(extractSchema);

    $scope.isType = function(column, field, type){
        var theField = extractSchema.findField(column, field);
        if(!column || !field){
            return false;
        }
        if(!theField){ return false; }
        if (_.isArray(type)){
            var match = false;
            _.each(type, function(t){ if(t == theField.type){ match = true; } });
            return match;
        }else{
            return theField.type == type;
        }
    };

    $scope.selectedInfo = undefined;

    $scope.selectInfo = function(query){
      $scope.selectedInfo = query;
    };

    $scope.getChoices = function(column, field){
      var modelField = extractSchema.findField(column, field);

      if(modelField.lookup_list && modelField.lookup_list.length){
        return $scope[modelField.lookup_list + "_list"];
      }

      if(modelField.enum){
        return modelField.enum;
      }
    };

    $scope.isBoolean = function(column, field){
        return $scope.isType(column, field, ["boolean", "null_boolean"]);
    };

    $scope.isText = function(column, field){
        return $scope.isType(column, field, "string") || $scope.isType(column, field, "text");
    };

    $scope.isSelect = function(column, field){
        return $scope.isType(column, field, "many_to_many");
    };

    $scope.isSelectMany = function(column, field){
        return $scope.isType(column, field, "many_to_many_multi_select");
    };

    $scope.isDate = function(column, field){
        return $scope.isType(column, field, "date");
    };

    $scope.isDateTime = function(column, field){
        return $scope.isType(column, field, "date_time");
    };

    $scope.isDateType = function(column, field){
        // if the field is a date or a date time
        return $scope.isDate(column, field) || $scope.isDateTime(column, field);
    };

    $scope.isNumber = function(column, field){
        return $scope.isType(column, field, ["float", "big_integer", "integer", "positive_integer_field", "decimal"]);
    };

    $scope.resetFilter = function(query, fieldsTypes){
      // when we change the column, reset the rest of the query
      $scope.extractQuery.resetFilter(query, fieldsTypes);
      if(query.column && query.field){
        $scope.selectInfo(query);
      }
      else{
        if($scope.selectedInfo && !$scope.selectedInfo.field){
          $scope.selectInfo(undefined);
        }
      }
    };

    //
    // Determine the appropriate lookup list for this field if
    // one exists.
    //
    $scope.refresh = function(){
      $scope.async_waiting = false;
      $scope.async_ready = false;
      $scope.searched = false;
      $scope.results = [];
    };

    $scope.$watch('extractQuery.criteria', $scope.refresh, true);

    $scope.search = function(pageNumber){
        if(!pageNumber){
            pageNumber = 1;
        }

        var queryParams = $scope.extractQuery.completeCriteria();

        if(queryParams.length){
            queryParams[0].page_number = pageNumber;
            ngProgressLite.set(0);
            ngProgressLite.start();
            $http.post('/search/extract/', queryParams).success(
                function(response){
                    $scope.results = _.map(response.object_list, function(o){
                        return new PatientSummary(o);
                    });
                    $scope.searched = true;
                    $scope.paginator = new Paginator($scope.search, response);
                    ngProgressLite.done();
                }).error(function(e){
                    ngProgressLite.set(0);
                    $window.alert('ERROR: Could not process this search. Please report it to the OPAL team');
                });
        }
        else{
          $scope.searched = true;
        }
    };

    $scope.async_extract = function(){
        if($scope.async_ready){
            $window.open('/search/extract/download/' + $scope.extract_id, '_blank');
            return null;
        }
        if($scope.async_waiting){
            return null;
        }

        var ping_until_success = function(){
            if(!$scope.extract_id){
                $timeout(ping_until_success, 1000);
                return;
            }
            $http.get('/search/extract/status/'+ $scope.extract_id).then(function(result){
                if(result.data.state == 'FAILURE'){
                    $window.alert('FAILURE');
                    $scope.async_waiting = false;
                    return;
                }
                if(result.data.state == 'SUCCESS'){
                    $scope.async_ready = true;
                }else{
                    if($scope.async_waiting){
                        $timeout(ping_until_success, 1000);
                    }
                }
            });
        };
        $scope.async_waiting = true;
        $http.post(
            '/search/extract/download',
            {
              criteria: JSON.stringify($scope.extractQuery.criteria),
              data_slice: JSON.stringify($scope.extractQuery.getDataSlices())
            }
        ).then(function(result){
            $scope.extract_id = result.data.extract_id;
            ping_until_success();
        });
    };

    $scope.jumpToFilter = function($event, filter){
        $event.preventDefault();
        $scope.extractQuery.criteria = filter.criteria;
    };

    $scope.editFilter = function($event, filter, $index){
      $event.preventDefault();
      var modal = $modal.open({
        templateUrl: '/search/templates/modals/save_filter_modal.html/',
        controller: 'SaveFilterCtrl',
        resolve: {
          params: function() { return $scope.filters[$index]; }
        }
      }).result.then(function(result){
        $scope.filters[$index] = result;
      });
    };

    $scope.save = function(){
      $modal.open({
        templateUrl: '/search/templates/modals/save_filter_modal.html/',
        controller: 'SaveFilterCtrl',
        resolve: {
          params: function() { return {name: null, criteria: $scope.extractQuery.completeCriteria()}; }
        }
      }).result.then(function(result){
        $scope.filters.push(result);
      });
    };
});
