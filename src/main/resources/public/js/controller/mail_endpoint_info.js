
app.controller('mailEndpointInfoController', function($scope, $location, $uibModal, $http, $timeout, utils, globalVars, restClient, auth) {


    //
    // Constants
    var extId = $location.search()["eid"];
    var isNew = (extId == null);
    var mailPathPlaceHolderTxt = 'e.g. (max@smockin.com)';
    var MockServerRunningStatus = globalVars.MockServerRunningStatus;
    var MockServerStoppedStatus = globalVars.MockServerStoppedStatus;


    //
    // Labels
    $scope.endpointHeading = (isNew) ? 'New Mail Inbox' : 'Mail Inbox';
    $scope.pathPlaceHolderTxt = mailPathPlaceHolderTxt;
    $scope.inboxAddressLabel = 'Inbox Address';
    $scope.saveReceivedMailLabel = 'Auto Save Received Messages';
    $scope.enabledLabel = "Enabled";
    $scope.disabledLabel = "Disabled";
    $scope.endpointStatusLabel = 'Status:';
    $scope.inboxMessagesLabel = 'Received Messages';
    $scope.noDataFoundMsg = 'No Messages Found';
    $scope.reloadMessagesLabel = 'refresh';
    $scope.yesLabel = 'Yes';
    $scope.noLabel = 'No';
    $scope.mailServerLabel = 'server';
    $scope.offlineLabel = 'offline';


    //
    // Table Labels
    $scope.senderTableLabel = 'From';
    $scope.subjectTableLabel = 'Subject';
    $scope.dateReceivedTableLabel = 'Date Received';
    $scope.savedLabel = 'Archived';
    $scope.actionTableLabel = '';


    //
    // Buttons
    $scope.deleteButtonLabel = 'Delete';
    $scope.saveButtonLabel = 'Save';
    $scope.cancelButtonLabel = 'Close';
    $scope.viewMessageButtonLabel = 'View';


    //
    // Alerts
    var alertPromise = null;
    $scope.alerts = [];

    var closeAlertFunc = function() {

        if (alertPromise != null) {
            $timeout.cancel( alertPromise );
            alertPromise = null;
        }

        $scope.alerts = [];
    };

    function showAlert(msg, type) {

        if (type == null) {
            type = 'danger';
        }

        closeAlertFunc();
        $scope.alerts.push({ "type" : type, "msg" : msg });

        alertPromise = $timeout(closeAlertFunc, globalVars.AlertTimeoutMillis);
    }

    $scope.closeAlert = closeAlertFunc;


    //
    // Data Objects
    $scope.activeStatus = globalVars.ActiveStatus;
    $scope.inActiveStatus = globalVars.InActiveStatus;
    $scope.isNew = isNew;
    $scope.mockServerStatus = MockServerStoppedStatus;
    $scope.mockServerRunningStatus = MockServerRunningStatus;
    $scope.mockServerStoppedStatus = MockServerStoppedStatus;
    $scope.endpoint = {
        "address" : null,
        "status" : globalVars.ActiveStatus,
        "saveReceivedMail" : false
    };
    $scope.mailMessages = [];


    //
    // Scoped Functions
    $scope.doSetEndpointStatus = function(s) {
        $scope.endpoint.status = s;
    };

    $scope.doSaveMailAddress = function() {

        // Validation
        if (utils.isBlank($scope.endpoint.address)) {
            showAlert("'Address' is required");
            return;
        }
        if ($scope.endpoint.address.length < 10) {
            showAlert("Invalid mail 'Address' format (min 10 chars)");
            return;
        }
        if ($scope.endpoint.address.indexOf("@") == -1
                || $scope.endpoint.address.indexOf(".") == -1) {
            showAlert("Invalid mail 'Address' format");
            return;
        }

        // Send to Server
        if (isNew) {

            createNewAddress($scope.endpoint.address,
                             $scope.endpoint.status,
                             $scope.endpoint.saveReceivedMail,
                             function (status, data) {

                                 utils.hideBlockingOverlay();

                                 if (status == 201) {
                                     $location.path("/dashboard").search({ "dv" : globalVars.MailServerMode });
                                     return;
                                 }

                                 handleErrorResponse(status, data);
                             });

        } else {

            updateAddress($scope.endpoint.extId,
                          $scope.endpoint.address,
                          $scope.endpoint.status,
                          $scope.endpoint.saveReceivedMail,
                            function (status, data) {

                                 utils.hideBlockingOverlay();

                                 if (status == 204) {
                                     showAlert('Mail Address successfully updated', 'success');
                                     loadMock();
                                     return;
                                 }

                                 handleErrorResponse(status, data);
                             });

        }
    };

    $scope.doDelete = function() {
        doDeleteAddress();
    };

    $scope.doReloadMock = function() {
        loadMock();
    };

    $scope.doClose = function() {

        $location.path("/dashboard").search({
            "dv" : globalVars.MailServerMode
        });
    };

    $scope.doOpenMailMessage = function(mailMessage) {

        $uibModal.open({
            templateUrl: 'mail_endpoint_message.html',
            controller: 'mailEndpointMessageController',
            backdrop  : 'static',
            keyboard  : false,
            resolve: {
                data: function () {
                    return mailMessage;
                }
            }
        });

    };


    //
    // Internal Functions
    function loadMock() {

        loadMockData(extId, function(endpoint) {

            $scope.endpoint = {
                "extId" : endpoint.externalId,
                "address" : endpoint.address,
                "status" : endpoint.status,
                "dateReceived" : endpoint.dateReceived,
                "saveReceivedMail" : endpoint.saveReceivedMail
            };

            // saved messages from DB
            $scope.mailMessages = endpoint.messages;

            // messages from mail server
            loadMailServerStatus(function() {
                loadInboxMessages();
            });

        });

    }

    function createNewAddress(address, status, saveReceivedMail, callbackFunc) {

        // Send to Server
        utils.showBlockingOverlay();

        var reqData = {
            "address" : address,
            "status" : status,
            "saveReceivedMail" : saveReceivedMail
        };

        restClient.doPost($http, '/mailmock', reqData, callbackFunc);
    }

    function updateAddress(extId, address, status, saveReceivedMail, callbackFunc) {

        // Send to Server
        utils.showBlockingOverlay();

        var reqData = {
            "address" : address,
            "status" : status,
            "saveReceivedMail" : saveReceivedMail
        };

        restClient.doPut($http, '/mailmock/' + extId, reqData, callbackFunc);
    }

    function doDeleteAddress() {

        if (isNew) {
            return;
        }

        utils.openDeleteConfirmation("Are you sure you wish to delete this mail address and all of it's content?", function (alertResponse) {
            if (alertResponse) {
                deleteAddress($scope.endpoint.extId);
            }
       });

    }

    function deleteAddress(extId) {

        if (isNew) {
            return;
        }

        utils.showBlockingOverlay();

        var serverCallbackFuncFollowingDelete = function (status, data) {

            utils.hideBlockingOverlay();

            if (status == 204) {

                $scope.doClose();
                return;
            }

            handleErrorResponse(status, data);
        };

        restClient.doDelete($http, '/mailmock/' + nodeType.toLowerCase() + '/' + extId, serverCallbackFuncFollowingDelete);

    }

    function loadMockData(extId, callback) {

        if (isNew) {
            return;
        }

        restClient.doGet($http, '/mailmock/' + extId, function(status, data) {

            if (status != 200) {
                showAlert(globalVars.GeneralErrorMessage);
                return;
            }

            callback(data);
        });

    }

    function loadInboxMessages() {

        if (isNew
                || $scope.endpoint.saveReceivedMail
                || $scope.mockServerStatus == MockServerStoppedStatus) {
            return;
        }

        restClient.doGet($http, '/mailmock/' + extId + '/inbox', function(status, data) {

            if (status != 200) {
                showAlert(globalVars.GeneralErrorMessage);
                return;
            }

            $scope.mailMessages = $scope.mailMessages.concat(data);
        });

    }

    function handleErrorResponse(status, data) {

        if (status == 400) {
            showAlert(data.message);
            return;
        } else if (status == 409) {
            showAlert("'" + $scope.endpoint.address + "' is already defined");
            return;
        }

        showAlert(globalVars.GeneralErrorMessage);
    }

    function loadMailServerStatus(callbackFunc) {

        utils.checkMailServerStatus(function(running, port) {

            if (running == null) {
                showAlert(globalVars.GeneralErrorMessage);
                return;
            }

            $scope.mockServerStatus = (running)
                ? MockServerRunningStatus
                : MockServerStoppedStatus;

            if (callbackFunc != null) {
                callbackFunc();
            }

        });

    }


    //
    // init page
    if (!isNew) {
        loadMock();
    }

});
