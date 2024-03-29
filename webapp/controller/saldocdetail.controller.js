sap.ui.define([
    "sap/ui/core/mvc/Controller",
    'sap/ui/model/Filter',
    "../js/Common",
    "../js/Utils",
    "sap/ui/model/json/JSONModel",
    'jquery.sap.global',
    'sap/m/MessageBox',
    'sap/ui/core/routing/HashChanger',
    "sap/ui/core/routing/History",
    'sap/m/MessageStrip',
    "../js/TableValueHelp",
    "../js/TableFilter"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, Filter, Common, Utils, JSONModel, jQuery, MessageBox, HashChanger, History, MessageStrip, TableValueHelp, TableFilter) {
        "use strict";

        var that;

        var Core = sap.ui.getCore();
        var _promiseResult;
        var _captionList = [];

        var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "MM/dd/yyyy" });
        var sapDateFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" });

        var timeFormat = sap.ui.core.format.DateFormat.getTimeInstance({ pattern: "KK:mm:ss a" });
        var TZOffsetMs = new Date(0).getTimezoneOffset() * 60 * 1000;

        return Controller.extend("zuisaldoc2.zuisaldoc2.controller.saldocdetail", {
            onInit: async function () {
                that = this;
                this.callCaptionsAPI();
                //get current userid
                var oModel = new sap.ui.model.json.JSONModel();
                oModel.loadData("/sap/bc/ui2/start_up").then(() => {
                    this._userid = oModel.oData.id;
                })

                this._Model = this.getOwnerComponent().getModel();
                this._Model2 = this.getOwnerComponent().getModel("ZGW_3DERP_COMMON_SRV");

                this._onBeforeDetailData = []
                this._isEdited = false
                this._validationErrors = [];

                //Initialize router
                var oComponent = this.getOwnerComponent();
                this._router = oComponent.getRouter();
                this._router.getRoute("RouteSalesDocDetail").attachPatternMatched(this._routePatternMatched, this);
                this.getView().setModel(new JSONModel({
                    editMode: 'READ',
                    Mode: 'NEW',
                    DisplayMode: 'change',
                    LockType: 'S',
                    LockMessage: '',
                    LockError: ''
                }), "ui");

                this._aColumns = {};
                this._tableFilter = TableFilter;
                this._colFilters = {};

                this._tableValueHelp = TableValueHelp;
                this._tblColumns = {}; 
                
                this.getView().setModel(new JSONModel(this.getOwnerComponent().getModel("CAPTION_MSGS_MODEL").getData().text), "ddtext");

                this.getAppAction();
            },

            callCaptionsAPI: async function(){
                var me = this;
                var oJSONModel = new JSONModel();
                var oDDTextParam = [];
                var oDDTextResult = [];
                var oModel = this.getOwnerComponent().getModel("ZGW_3DERP_COMMON_SRV");

                oDDTextParam.push({CODE: "FLTRCRIT"});
                oDDTextParam.push({CODE: "OK"});
                oDDTextParam.push({CODE: "CANCEL"});
                oDDTextParam.push({CODE: "CLRFLTRS"});
                oDDTextParam.push({CODE: "REMOVEFLTR"});
                oDDTextParam.push({CODE: "VALUELIST"});
                oDDTextParam.push({CODE: "USERDEF"});
                oDDTextParam.push({CODE: "SEARCH"});

                await oModel.create("/CaptionMsgSet", { CaptionMsgItems: oDDTextParam  }, {
                    method: "POST",
                    success: function(oData, oResponse) {
                        oData.CaptionMsgItems.results.forEach(item=>{
                            oDDTextResult[item.CODE] = item.TEXT;
                        })
                        
                        // console.log(oDDTextResult)
                        oJSONModel.setData(oDDTextResult);
                        that.getView().setModel(oJSONModel, "captionMsg");
                        me.getOwnerComponent().getModel("CAPTION_MSGS_MODEL").setData({text: oDDTextResult});
                    },
                    error: function(err) {
                        sap.m.MessageBox.error(err);
                    }
                });
            },

            getAppAction: async function () {
                // console.log("getAppAction");
                // console.log(sap.ushell.Container)
                var csAction = "change";
                if (sap.ushell.Container !== undefined) {
                    const fullHash = new HashChanger().getHash();
                    const urlParsing = await sap.ushell.Container.getServiceAsync("URLParsing");
                    const shellHash = urlParsing.parseShellHash(fullHash);
                    csAction = shellHash.action;
                }

                var DisplayStateModel = new JSONModel();
                var DisplayData = {
                    sAction : csAction,
                    visible : csAction === "display" ? false : true
                }

                this.getView().getModel("ui").setProperty("/DisplayMode", csAction);
                this.getView().setModel(new JSONModel(),"onSuggCustSoldTo");
                this.getView().setModel(new JSONModel(),"onSuggCustBillTo");

                DisplayStateModel.setData(DisplayData);
                this.getView().setModel(DisplayStateModel, "DisplayActionModel");

                // this.byId("btnHdrEdit").setVisible(csAction === "display" ? false : true);
                // this.byId("btnHdrDelete").setVisible(csAction === "display" ? false : true);
                this.byId("btnDetAdd").setVisible(csAction === "display" ? false : true);
                this.byId("btnDetEdit").setVisible(csAction === "display" ? false : true);
                this.byId("btnDetDelete").setVisible(csAction === "display" ? false : true);
            },

            _routePatternMatched: async function (oEvent) {
                Common.openLoadingDialog(that);
                var me = this;
                this.initButtons();

                this._salesDocNo = oEvent.getParameter("arguments").salesdocno; //get Style from route pattern
                this._sbu = oEvent.getParameter("arguments").sbu; //get SBU from route pattern

                //set all as no changes at first load
                this._headerChanged = false;

                //set Change Status
                this.setChangeStatus(false);
                await this.onSuggestionItems();

                //Load header
                await this.getHeaderConfig(); //get visible header fields


                if (this._salesDocNo === "NEW") {
                    //create new - only header is editable at first
                    this.byId("CUSTSOLDTO").setEnabled(false);
                    this.byId("CUSTBILLTO").setEnabled(false);
                    this.getView().getModel("ui").setProperty("/Mode", 'NEW');
                    await this.setNewHeaderEditMode();
                    // this.setDetailVisible(false);
                } else {
                    //existing style, get the style data
                    this.getView().getModel("ui").setProperty("/Mode", 'UPDATE');
                    await this.getHeaderData(); //get header data
                    await this.onSuggestionItems_CUSTSHIPTO();
                    this.cancelHeaderEdit();
                    // this.setDetailVisible(true); //make detail section visible
                    this.byId("btnHdrEdit").setVisible(me.getView().getModel("ui").getProperty("/DisplayMode") === "display" ? false : true);
                    this.byId("btnHdrDelete").setVisible(me.getView().getModel("ui").getProperty("/DisplayMode") === "display" ? false : true);
                }

                // build Dynamic table for Sales Document Details
                await this.getDynamicTableColumns();

                //This Section remove required Field Indicator when initializing page
                this._validationErrors = [];
                var me = this;
                var oView = this.getView();
                var formView = this.getView().byId("SalesDocHeaderForm1"); //Form View
                var formContainers = formView.getFormContainers(); // Form Container
                var formElements = ""; //Form Elements
                var formFields = ""; // Form Field
                var formElementsIsVisible = false; //is Form Element Visible Boolean
                var fieldIsEditable = false; // is Field Editable Boolean
                var fieldMandatory = ""; // Field Mandatory variable
                var fieldIsMandatory = false; // Is Field Mandatory Boolean
                var oMandatoryModel = oView.getModel("MandatoryFieldsData").getProperty("/");

                //Form Validations
                //Iterate Form Containers
                for (var index in formContainers) {
                    formElements = formContainers[index].getFormElements(); //get Form Elements

                    //iterate Form Elements
                    for (var elementIndex in formElements) {
                        formElementsIsVisible = formElements[elementIndex].getProperty("visible"); //get the property Visible of Element
                        if (formElementsIsVisible) {
                            formFields = formElements[elementIndex].getFields(); //get FIelds in Form Element

                            //Iterate Fields
                            for (var formIndex in formFields) {
                                fieldMandatory = formFields[formIndex].getBindingInfo("value") === undefined ? "" : formFields[formIndex].getBindingInfo("value").mandatory;

                                fieldIsMandatory = oMandatoryModel[fieldMandatory] === undefined ? false : oMandatoryModel[fieldMandatory];

                                if (fieldIsMandatory) {
                                    fieldIsEditable = formFields[formIndex].getProperty("editable"); //get the property Editable of Fields
                                    if (fieldIsEditable) {
                                        formFields[formIndex].setValueState("None");
                                        me._validationErrors.forEach((item, index) => {
                                            if (item === formFields[formIndex].getId()) {
                                                me._validationErrors.splice(index, 1)
                                            }
                                        })
                                    }
                                }
                            }
                        }
                    }

                }
                await this.getColumnProp();
                Common.closeLoadingDialog(that);
            },

            initButtons: function(){
                this.getView().getModel("ui").setProperty("/editMode", 'READ');
                //Header
                this.byId("TB1").setEnabled(true);
                this.byId("btnHdrEdit").setVisible(true);
                this.byId("btnHdrDelete").setVisible(true);
                this.byId("btnHdrClose").setVisible(true);
                this.byId("btnHdrSave").setVisible(false);
                this.byId("btnHdrCancel").setVisible(false);

                //Details
                this.byId("btnDetAdd").setVisible(true);
                this.byId("btnDetEdit").setVisible(true);
                this.byId("btnDetDelete").setVisible(true);
                this.byId("btnDetDeleteEditRow").setVisible(false);
                this.byId("btnDetSave").setVisible(false);
                this.byId("btnDetCancel").setVisible(false);
                this.byId("btnDetTabLayout").setVisible(true);
                this.byId("btnDetBtnFullScreen").setVisible(true);
                this.byId("btnDetBtnExitFullScreen").setVisible(false);
            },


            validateIfSoldCustAndBillCustHasValue: async function(){
                var headerData = this.getView().getModel("headerData").getData();
                var me = this;
                var oView = this.getView();
                var formView = this.getView().byId("SalesDocHeaderForm1"); //Form View
                var formContainers = formView.getFormContainers(); // Form Container
                var formElements = ""; //Form Elements
                var formFields = ""; // Form Field
                var formElementsIsVisible = false; //is Form Element Visible Boolean
                var fieldIsEditable = false; // is Field Editable Boolean
                var fieldMandatory = ""; // Field Mandatory variable
                var fieldIsMandatory = false; // Is Field Mandatory Boolean
                var oMandatoryModel = oView.getModel("MandatoryFieldsData").getProperty("/");

                //Form Validations
                //Iterate Form Containers
                for (var index in formContainers) {
                    formElements = formContainers[index].getFormElements(); //get Form Elements

                    //iterate Form Elements
                    for (var elementIndex in formElements) {
                        formElementsIsVisible = formElements[elementIndex].getProperty("visible"); //get the property Visible of Element
                        if (formElementsIsVisible) {
                            formFields = formElements[elementIndex].getFields(); //get FIelds in Form Element

                            //Iterate Fields
                            for (var formIndex in formFields) {
                                fieldMandatory = formFields[formIndex].getBindingInfo("value") === undefined ? "" : formFields[formIndex].getBindingInfo("value").mandatory;

                                fieldIsMandatory = oMandatoryModel[fieldMandatory] === undefined ? false : oMandatoryModel[fieldMandatory];

                                if (fieldIsMandatory) {
                                    fieldIsEditable = formFields[formIndex].getProperty("editable"); //get the property Editable of Fields
                                    if (fieldIsEditable) {
                                        if(formFields[formIndex].getId().includes("CUSTGRP")){
                                            if(formFields[formIndex].getSuggestionItems().length > 0){
                                                formFields[formIndex].getSuggestionItems().forEach(async item => {
                                                    if (item.getProperty("key") === headerData.CUSTGRP) {
                                                        await me.onSuggestionItems_CUSTSOLDTO();
                                                        if(me.getView().getModel("onSuggCustSoldTo").getData().length > 0){
                                                            me.getView().getModel("onSuggCustSoldTo").getData().forEach(async item =>{
                                                                if (item.CUSTSOLDTO === headerData.CUSTSOLDTO) {
                                                                    await me.onSuggestionItems_CUSTBILLTO();
                                                                }
                                                            })
                                                        }
                                                    }
                                                })
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                }
            },

            getColumnProp: async function() {
                var sPath = jQuery.sap.getModulePath("zuisaldoc2.zuisaldoc2", "/model/columns.json");
    
                var oModelColumns = new JSONModel();
                await oModelColumns.loadData(sPath);
    
                this._tblColumns = oModelColumns.getData();
                this._oModelColumns = oModelColumns.getData();
            },

            onSuggestionItems: async function(){
                var me = this;
                var vSBU = this._sbu;
                var oModel = this.getOwnerComponent().getModel();
                var oModelFilter = this.getOwnerComponent().getModel('ZVB_3DERP_SALDOC_FILTERS_CDS');
                var oModel3DERP = this.getOwnerComponent().getModel('ZGW_3DERP_SH_SRV');

                //SalesDocNo
                await new Promise((resolve, reject) => {
                    oModelFilter.read('/ZVB_3DERP_SALDOCTYP_SH', {
                        success: function (data, response) {
                            data.results.forEach(item => {
                                item.SALESDOCTYP = item.Salesdoctyp;
                                item.Item = item.Salesdoctyp;
                                item.Desc = item.Description;
                            })

                            me.getView().setModel(new JSONModel(data.results),"onSuggSalDocTyp");


                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });

                //SalesOrg
                await new Promise((resolve, reject) => {
                    oModelFilter.read('/ZVB_3DERP_SALESORG_SH', {
                        success: function (data, response) {
                            data.results.forEach(item => {
                                item.Item = item.SALESORG;
                                item.Desc = item.DESCRIPTION;
                            })

                            me.getView().setModel(new JSONModel(data.results),"onSuggSalesOrg");
                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });

                //CustGrp
                await new Promise((resolve, reject) => {
                    oModelFilter.read('/ZVB_3DERP_CUSTGRP_SH', {
                        success: function (data, response) {
                            data.results.forEach(item => {
                                item.Item = item.CUSTGRP;
                                item.Desc = item.DESCRIPTION;
                            })

                            me.getView().setModel(new JSONModel(data.results),"onSuggCustGrp");
                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });

                //PurTaxCd
                await new Promise((resolve, reject) => {
                    oModelFilter.read('/ZBV_3D_PURTAX_SH', {
                        success: function (data, response) {
                            data.results.forEach(item => {
                                item.PURTAXCD = item.Zolla;
                                item.Item = item.Zolla;
                                item.Desc = item.DESCRIPTION;
                            })

                            me.getView().setModel(new JSONModel(data.results),"onSuggPurTaxCd");
                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });

                //Sales Term
                await new Promise((resolve, reject) => {
                    oModelFilter.read('/ZVB_3D_INCTRM_SH', {
                        success: function (data, response) {
                            data.results.forEach(item => {
                                item.SALESTERM = item.Inco1;
                                item.Item = item.Inco1;
                                item.Desc = item.DESCRIPTION;
                            })

                            me.getView().setModel(new JSONModel(data.results),"onSuggSalesTerm");
                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });

                //CurrencyCd
                await new Promise((resolve, reject) => {
                    oModelFilter.read('/ZVB_3DERP_CURRSH', {
                        success: function (data, response) {
                            data.results.forEach(item => {
                                item.CURRENCYCD = item.Waers;
                                item.Item = item.Waers;
                                item.Desc = item.DESCRIPTION;
                            })

                            me.getView().setModel(new JSONModel(data.results),"onSuggCurrencyCd");
                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });

                //DestChannel
                await new Promise((resolve, reject) => {
                    oModelFilter.read('/ZBV_3D_DSTCHN_SH', {
                        success: function (data, response) {
                            data.results.forEach(item => {
                                item.DSTCHAN = item.Vtweg;
                                item.Item = item.Vtweg;
                                item.Desc = item.DESCRIPTION;
                            })

                            me.getView().setModel(new JSONModel(data.results),"onSuggDestChannel");
                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });

                //Division
                await new Promise((resolve, reject) => {
                    oModelFilter.read('/ZBV_3D_DIV_SH', {
                        success: function (data, response) {
                            data.results.forEach(item => {
                                item.DIVISION = item.Spart;
                                item.Item = item.Spart;
                                item.Desc = item.DESCRIPTION;
                            })

                            me.getView().setModel(new JSONModel(data.results),"onSuggDivision");
                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });

                //SalesGrp
                await new Promise((resolve, reject) => {
                    oModelFilter.read('/ZVB_3DERP_SALESGRP_SH', {
                        success: function (data, response) {
                            data.results.forEach(item => {
                                item.Item = item.SALESGRP;
                                item.Desc = item.DESCRIPTION;
                            })

                            me.getView().setModel(new JSONModel(data.results),"onSuggSalesGrp");
                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });

                //SeasonCd
                await new Promise((resolve, reject) => {
                    oModelFilter.read('/ZVB_3DERP_SEASON_SH', {
                        success: function (data, response) {
                            data.results.forEach(item => {
                                item.Item = item.SEASONCD;
                                item.Desc = item.DESCRIPTION;
                            })

                            data.results.sort((a, b) => (a.YR > b.YR ? 1 : -1));

                            me.getView().setModel(new JSONModel(data.results),"onSuggSeasonCd");
                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });

                //UOM
                await new Promise((resolve, reject) => {
                    oModel.read('/UOMvhSet', {
                        success: function (data, response) {
                            data.results.forEach(item => {
                                item.UOM = item.MSEHI;
                                item.Item = item.MSEHI;
                                item.Desc = item.MSEHL;
                            })
                            me.getView().setModel(new JSONModel(data.results),"onSuggUOM");
                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });

                //PRODUCTTYP
                await new Promise((resolve, reject) => {
                    oModel.read('/PRODUCTTYPvhSet', {
                        urlParameters: {
                            "$filter": "SBU eq '" + vSBU + "'"
                        },
                        success: function (data, response) {
                            data.results.forEach(item => {
                                item.PRODUCTTYP = item.PRODTYP;
                                item.Item = item.PRODTYP;
                                item.Desc = item.DESC1;
                            })

                            me.getView().setModel(new JSONModel(data.results),"onSuggPRODUCTTYP");
                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });
            },

            //Suggestion Items with Prerequisite and need to reinitialize
            onSuggestionItems_CUSTSOLDTO: async function(){
                var me = this;
                var vSBU = this._sbu;
                var oModel3DERP = this.getOwnerComponent().getModel('ZGW_3DERP_SH_SRV');
                //Sold to Customer
                var custGrp = this.getView().getModel("headerData").getData().CUSTGRP;
                if(custGrp === "" || custGrp === null || custGrp === undefined){
                    return;
                }else{
                    await new Promise((resolve, reject) => {
                        oModel3DERP.setHeaders({
                            sbu: vSBU
                        });
                        oModel3DERP.read('/SoldToCustSet', {
                            success: function (data, response) {
                                var dataResult = [];
                                data.results.forEach(item => {
                                    if(custGrp === item.Custgrp){
                                        item.CUSTSOLDTO = item.Custno;
                                        item.Item = item.Custno;
                                        item.Desc = item.Desc1;
                                        dataResult.push(item)
                                    }
                                })

                                me.getView().setModel(new JSONModel(dataResult),"onSuggCustSoldTo");
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                }
            },
            onSuggestionItems_CUSTBILLTO: async function(){
                var me = this;
                var oModelFilter = this.getOwnerComponent().getModel('ZVB_3DERP_SALDOC_FILTERS_CDS');

                //Bill To Customer
                var custSoldTo = this.getView().getModel("headerData").getData().CUSTSOLDTO;
                if(custSoldTo === "" || custSoldTo === null || custSoldTo === undefined){
                    return;
                }else{
                    await new Promise((resolve, reject) => {
                        oModelFilter.read('/ZVB_3D_CBLLTO_SH', {
                            success: function (data, response) {
                                var dataResult = [];
                                data.results.forEach(item => {
                                    while (item.KUNNR.length < 10) item.KUNNR = "0" + item.KUNNR;
                                    while (item.SOLDTOCUST.length < 10) item.SOLDTOCUST = "0" + item.SOLDTOCUST;
                                    if(item.SOLDTOCUST === custSoldTo){
                                        item.CUSTBILLTO = item.KUNNR;
                                        item.Item = item.KUNNR;
                                        item.Desc = item.Name;
                                        dataResult.push(item)
                                    }
                                })

                                me.getView().setModel(new JSONModel(dataResult),"onSuggCustBillTo");
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                }
            },
            onSuggestionItems_CUSTSHIPTO: async function(){
                var me = this;
                var oModel = this.getOwnerComponent().getModel();

                //CustShipTo
                var soldToCostHeader = this.getView().getModel("headerData").getData().CUSTSOLDTO;
                await new Promise((resolve, reject) => {
                    oModel.read('/SHIPTOvhSet', {
                        success: function (data, response) {
                            var dataResult = [];
                            data.results.forEach(item => {
                                if(soldToCostHeader === item.SOLDTOCUST){
                                    item.CUSTSHIPTO = item.KUNNR;
                                    item.Item = item.KUNNR;
                                    item.Desc = item.DESC1;
                                    dataResult.push(item)
                                }
                            })
                            me.getView().setModel(new JSONModel(dataResult),"onSuggCUSTSHIPTO");
                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });

            },

            formatValueHelp: function(sValue, sPath, sKey, sText, sFormat) {
                if(this.getView().getModel(sPath) !== undefined){
                    if(this.getView().getModel(sPath).getData().length > 0){
                        var oValue = this.getView().getModel(sPath).getData().filter(v => v[sKey] === sValue);
                        if (oValue && oValue.length > 0) {
                            if (sFormat === "Value") {
                                return oValue[0][sText];
                            }
                            else if (sFormat === "ValueKey") {
                                return oValue[0][sText] + " (" + sValue + ")";
                            }
                            else if (sFormat === "KeyValue") {
                                return sValue + " (" + oValue[0][sText] + ")";
                            }
                            else {
                                return sValue;
                            }
                        }
                        else return sValue;
                    }else return sValue;
                }
                
            },

            setReqField: async function(isEdit){
                var me = this;
                var oView = this.getView();
                var formView = this.getView().byId("SalesDocHeaderForm1"); //Form View
                var formContainers = formView.getFormContainers(); // Form Container
                var formElements = ""; //Form Elements
                var formFields = ""; // Form Field
                var formElementsIsVisible = false; //is Form Element Visible Boolean
                var fieldIsEditable = false; // is Field Editable Boolean
                var fieldMandatory = ""; // Field Mandatory variable
                var fieldIsMandatory = false; // Is Field Mandatory Boolean
                var oMandatoryModel = oView.getModel("MandatoryFieldsData").getProperty("/");
                var label = "";

                //Form Validations
                //Iterate Form Containers
                for (var index in formContainers) {
                    formElements = formContainers[index].getFormElements(); //get Form Elements

                    //iterate Form Elements
                    for (var elementIndex in formElements) {
                        formElementsIsVisible = formElements[elementIndex].getProperty("visible"); //get the property Visible of Element
                        if (formElementsIsVisible) {
                            formFields = formElements[elementIndex].getFields(); //get FIelds in Form Element

                            //Iterate Fields
                            for (var formIndex in formFields) {
                                fieldMandatory = formFields[formIndex].getBindingInfo("value") === undefined ? "" : formFields[formIndex].getBindingInfo("value").mandatory;

                                fieldIsMandatory = oMandatoryModel[fieldMandatory] === undefined ? false : oMandatoryModel[fieldMandatory];

                                if (fieldIsMandatory) {
                                    if(isEdit){
                                        label = formElements[elementIndex].getLabel().replace("*", "");
                                        formElements[elementIndex].setLabel("*" + label);
                                        formElements[elementIndex]._oLabel.addStyleClass("requiredField");
                                    }else{
                                        label = formElements[elementIndex].getLabel().replace("*", "");
                                        formElements[elementIndex].setLabel(label);
                                        formElements[elementIndex]._oLabel.removeStyleClass("requiredField");
                                    }
                                }
                            }
                        }
                    }

                }
            },

            //Handle Value Help Not Used
            handleValueHelp: async function (oEvent) {
                var me = this;
                var vSBU = this._sbu;

                var oModel = this.getOwnerComponent().getModel();
                var oModelFilter = this.getOwnerComponent().getModel('ZVB_3DERP_SALDOC_FILTERS_CDS');
                var oModel3DERP = this.getOwnerComponent().getModel('ZGW_3DERP_SH_SRV');
                var oSource = oEvent.getSource();

                var fieldName = oSource.getBindingInfo("value").parts[0].path.replace("/", "");

                this._inputId = oSource.getId();
                this._inputValue = oSource.getValue();
                this._inputSource = oSource;

                var valueHelpObjects = [];
                var title = "";

                if (fieldName === 'SALESGRP') {
                    await new Promise((resolve, reject) => {
                        oModelFilter.read('/ZVB_3DERP_SALESGRP_SH', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    item.Item = item.SALESGRP;
                                    item.Desc = item.DESCRIPTION;
                                })

                                valueHelpObjects = data.results;
                                title = "Sales Group"
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                } else if (fieldName === 'CUSTGRP') {
                    await new Promise((resolve, reject) => {
                        oModelFilter.read('/ZVB_3DERP_CUSTGRP_SH', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    item.Item = item.CUSTGRP;
                                    item.Desc = item.DESCRIPTION;
                                })

                                valueHelpObjects = data.results;
                                title = "Customer Group"
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                } else if (fieldName === 'SALESORG') {
                    await new Promise((resolve, reject) => {
                        oModelFilter.read('/ZVB_3DERP_SALESORG_SH', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    item.Item = item.SALESORG;
                                    item.Desc = item.DESCRIPTION;
                                })

                                valueHelpObjects = data.results;
                                title = "Sales Org."
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                } else if (fieldName === 'SEASONCD') {
                    await new Promise((resolve, reject) => {
                        oModelFilter.read('/ZVB_3DERP_SEASON_SH', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    item.Item = item.SEASONCD;
                                    item.Desc = item.DESCRIPTION;
                                })

                                data.results.sort((a, b) => (a.YR > b.YR ? 1 : -1));

                                valueHelpObjects = data.results;
                                title = "Season"
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                } else if (fieldName === 'SALESDOCTYP') {
                    await new Promise((resolve, reject) => {
                        oModelFilter.read('/ZVB_3DERP_SALDOCTYP_SH', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    item.SALESDOCTYP = item.Salesdoctyp;
                                    item.Item = item.Salesdoctyp;
                                    item.Desc = item.Description;
                                })

                                valueHelpObjects = data.results;
                                title = "Sales Doc. Type"
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                } else if (fieldName === 'CUSTSOLDTO') {

                    var custGrp = this.getView().byId("CUSTGRP").getValue();
                    if(custGrp === "" || custGrp === null || custGrp === undefined){
                        this.getView().byId("CUSTGRP").setValueState("Error");
                        this.getView().byId("CUSTGRP").setValueStateText("Required Field!");
                        MessageBox.error("Please Select Customer Group First!");
                        return;
                    }else{
                        await new Promise((resolve, reject) => {
                            oModel3DERP.setHeaders({
                                sbu: this._sbu
                            });
                            oModel3DERP.read('/SoldToCustSet', {
                                success: function (data, response) {
                                    var dataResult = [];
                                    data.results.forEach(item => {
                                        if(custGrp === item.Custgrp){
                                            item.CUSTSOLDTO = item.Custno;
                                            item.Item = item.Custno;
                                            item.Desc = item.Desc1;
                                            dataResult.push(item)
                                        }
                                    })

                                    valueHelpObjects = dataResult;
                                    title = "Sold-to Customer"
                                    resolve();
                                },
                                error: function (err) {
                                    resolve();
                                }
                            });
                        });

                    }
                } else if (fieldName === 'CUSTBILLTO') {

                    var custSoldTo = this.getView().byId("CUSTSOLDTO").getValue();

                    if(custSoldTo === "" || custSoldTo === null || custSoldTo === undefined){
                        this.getView().byId("CUSTSOLDTO").setValueState("Error");
                        this.getView().byId("CUSTSOLDTO").setValueStateText("Required Field!");
                        MessageBox.error("Please Select Sold-To Customer First!");
                        return;
                    }else{
                        await new Promise((resolve, reject) => {
                            oModelFilter.read('/ZVB_3D_CBLLTO_SH', {
                                success: function (data, response) {
                                    var dataResult = [];
                                    data.results.forEach(item => {
                                        while (item.KUNNR.length < 10) item.KUNNR = "0" + item.KUNNR;
                                        while (item.SOLDTOCUST.length < 10) item.SOLDTOCUST = "0" + item.SOLDTOCUST;
                                        if(item.SOLDTOCUST === custSoldTo){
                                            item.CUSTBILLTO = item.KUNNR;
                                            item.Item = item.KUNNR;
                                            item.Desc = item.Name;
                                            dataResult.push(item)
                                        }
                                    })

                                    valueHelpObjects = dataResult;
                                    title = "Bill-to Customer"
                                    resolve();
                                },
                                error: function (err) {
                                    resolve();
                                }
                            });
                        });
                    }
                } else if (fieldName === 'CUSTSHIPTO') {
                    var soldToCostHeader = this.byId("CUSTSOLDTO").getValue();
                    if(soldToCostHeader === ""){
                        MessageBox.error("Sold-To Cust Field is Required.");
                        return;
                    }else{
                        await new Promise((resolve, reject) => {
                            oModel.read('/SHIPTOvhSet', {
                                success: function (data, response) {
                                    var dataResult = [];
                                    data.results.forEach(item => {
                                        if(soldToCostHeader === item.SOLDTOCUST){
                                            item.CUSTSHIPTO = item.KUNNR;
                                            item.Item = item.KUNNR;
                                            item.Desc = item.DESC1;
                                            dataResult.push(item)
                                        }
                                    })

                                    valueHelpObjects = dataResult;
                                    title = "Ship-To Customer"
                                    resolve();
                                },
                                error: function (err) {
                                    resolve();
                                }
                            });
                        });
                    }

                } else if (fieldName === 'CURRENCYCD') {
                    await new Promise((resolve, reject) => {
                        oModelFilter.read('/ZVB_3DERP_CURRSH', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    item.CURRENCYCD = item.Waers;
                                    item.Item = item.Waers;
                                    item.Desc = item.DESCRIPTION;
                                })

                                valueHelpObjects = data.results;
                                title = "Currency Code"
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                } else if (fieldName === 'DSTCHAN') {
                    await new Promise((resolve, reject) => {
                        oModelFilter.read('/ZBV_3D_DSTCHN_SH', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    item.DSTCHAN = item.Vtweg;
                                    item.Item = item.Vtweg;
                                    item.Desc = item.DESCRIPTION;
                                })

                                valueHelpObjects = data.results;
                                title = "Destination Channel"
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                } else if (fieldName === 'DIVISION') {
                    await new Promise((resolve, reject) => {
                        oModelFilter.read('/ZBV_3D_DIV_SH', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    item.DIVISION = item.Spart;
                                    item.Item = item.Spart;
                                    item.Desc = item.DESCRIPTION;
                                })

                                valueHelpObjects = data.results;
                                title = "Division"
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                } else if (fieldName === 'PAYMETHODCD') {
                    await new Promise((resolve, reject) => {
                        oModelFilter.read('/ZVB_3D_PYMTHDSH', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    item.Item = item.Zlsch;
                                    item.Desc = item.DESCRIPTION;
                                })

                                valueHelpObjects = data.results;
                                title = "Payment Method"
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                } else if (fieldName === 'PURTAXCD') {
                    await new Promise((resolve, reject) => {
                        oModelFilter.read('/ZBV_3D_PURTAX_SH', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    item.PURTAXCD = item.Zolla;
                                    item.Item = item.Zolla;
                                    item.Desc = item.DESCRIPTION;
                                })

                                valueHelpObjects = data.results;
                                title = "Purchasing Tax"
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                } else if (fieldName === 'SALESTERM') {
                    await new Promise((resolve, reject) => {
                        oModelFilter.read('/ZVB_3D_INCTRM_SH', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    item.SALESTERM = item.Inco1;
                                    item.Item = item.Inco1;
                                    item.Desc = item.DESCRIPTION;
                                })

                                valueHelpObjects = data.results;
                                title = "Sales Term"
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                } else if (fieldName === 'SALESTERMTEXT') {
                    await new Promise((resolve, reject) => {
                        oModelFilter.read('/ZVB_3D_INCTRM_SH', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    item.SALESTERM = item.Inco1;
                                    item.Item = item.DESCRIPTION;
                                    item.Desc = item.Inco1;
                                })

                                valueHelpObjects = data.results;
                                title = "Sales Term Desc."
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                } else if (fieldName === 'UOM') {
                    await new Promise((resolve, reject) => {
                        oModel.read('/UOMvhSet', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    item.UOM = item.MSEHI;
                                    item.Item = item.MSEHI;
                                    item.Desc = item.MSEHL;
                                })

                                valueHelpObjects = data.results;
                                title = "Select UOM"
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                } else if (fieldName === 'IOTYPE') {
                    await new Promise((resolve, reject) => {
                        oModel.read('/IOTYPvhSet', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    item.Item = item.IOTYPE;
                                    item.Desc = item.DESC1;
                                })

                                valueHelpObjects = data.results;
                                title = "Select IO Type"
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                } else if (fieldName === 'PRODSCEN') {
                    await new Promise((resolve, reject) => {
                        oModel.read('/PRODSCENvhSet', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    item.Item = item.PRODSCEN;
                                    item.Desc = item.DESC1;
                                })

                                valueHelpObjects = data.results;
                                title = "Select Prod. Scenario"
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                } else if (fieldName === 'PRODUCTTYP') {
                    await new Promise((resolve, reject) => {
                        oModel.read('/PRODUCTTYPvhSet', {
                            urlParameters: {
                                "$filter": "SBU eq '" + vSBU + "'"
                            },
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    item.Item = item.PRODTYP;
                                    item.Desc = item.DESC1;
                                })

                                valueHelpObjects = data.results;
                                title = "Select Prod. Type"
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                } else if (fieldName === 'STYLECAT') {
                    await new Promise((resolve, reject) => {
                        oModel3DERP.setHeaders({
                            sbu: this._sbu
                        });
                        oModel3DERP.read('/StyleCatSet', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    item.Item = item.Stylcat;
                                    item.Desc = item.Desc1;
                                })

                                valueHelpObjects = data.results;
                                title = "Select Style Category"
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                } else if (fieldName === 'SIZEGRP') {
                    await new Promise((resolve, reject) => {
                        oModel3DERP.read('/SizeGrpSet', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    item.Item = item.AttribGrp;
                                    // item.Desc = item.Desc1;
                                })

                                valueHelpObjects = data.results;
                                title = "Select Size Group"
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                } else if (fieldName === 'WEAVETYP') {
                    await new Promise((resolve, reject) => {
                        oModel3DERP.setHeaders({
                            attribtyp: "WVTYP"
                        });
                        oModel3DERP.read('/AttribCode2Set', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    item.Item = item.Attribcd;
                                    item.Desc = item.Desc1;
                                })

                                valueHelpObjects = data.results;
                                title = "Select Weave Type"
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                }

                var oVHModel = new JSONModel({
                    items: valueHelpObjects,
                    title: title
                });
                // create value help dialog
                if (!this._valueHelpDialog) {
                    this._valueHelpDialog = sap.ui.xmlfragment(
                        "zuisaldoc2.zuisaldoc2.view.fragments.valuehelp.ValueHelpDialog",
                        this
                    );

                    this._valueHelpDialog.setModel(oVHModel);
                    this.getView().addDependent(this._valueHelpDialog);
                }
                else {
                    this._valueHelpDialog.setModel(oVHModel);
                }
                this._valueHelpDialog.open();
            },
            handleValueHelpClose: async function (oEvent) {
                if (oEvent.sId === "confirm") {
                    var oSelectedItem = oEvent.getParameter("selectedItem");
                    // var sTable = this._valueHelpDialog.getModel().getData().table;

                    if (oSelectedItem) {
                        this._inputSource.setValue(oSelectedItem.getTitle());
                        var oModelFilter = this.getOwnerComponent().getModel('ZVB_3DERP_SALDOC_FILTERS_CDS');
                        var resultData = "";
                        if (this._inputSource.getId().includes("SALESTERM")) {
                            var salesTermVal = this.getView().byId("SALESTERM").getValue();
                            var salesTermTxtLbl = this.getView().byId("SALESTERMTEXT");
                            await new Promise((resolve, reject) => {
                                oModelFilter.read('/ZVB_3D_INCTRM_SH', {
                                    success: function (data, response) {
                                        data.results.forEach(item => {
                                            if (item.Inco1 === salesTermVal) {
                                                resultData = item.DESCRIPTION;
                                            }
                                        })

                                        salesTermTxtLbl.setValue(resultData);
                                        resolve();
                                    },
                                    error: function (err) {
                                        resolve();
                                    }
                                });
                            });
                        }

                        // var sRowPath = this._inputSource.getBindingInfo("value").binding.oContext.sPath;

                        if (this._inputValue !== oSelectedItem.getTitle()) {
                            // this.getView().getModel("mainTab").setProperty(sRowPath + '/Edited', true);

                            this._bHeaderChanged = true;
                        }
                    }

                    this._inputSource.setValueState("None");
                }
                else if (oEvent.sId === "cancel") {

                }
            },
            handleValueHelpSearch: async function (oEvent) {
                var sValue = oEvent.getParameter("value");

                var oFilter = new sap.ui.model.Filter({
                    filters: [
                        new sap.ui.model.Filter("Item", sap.ui.model.FilterOperator.Contains, sValue),
                        new sap.ui.model.Filter("Desc", sap.ui.model.FilterOperator.Contains, sValue)
                    ],
                    and: false
                });

                oEvent.getSource().getBinding("items").filter([oFilter]);
            },
            //Handle Value Help Not Used

            getDynamicTableColumns: async function () {
                var me = this;

                //get dynamic columns based on saved layout or ZERP_CHECK
                var oJSONColumnsModel = new sap.ui.model.json.JSONModel();
                this.oJSONModel = new sap.ui.model.json.JSONModel();
                var oModel = this.getOwnerComponent().getModel("ZGW_3DERP_COMMON_SRV");

                // this._SBU = this.getView().byId("SmartFilterBar").getFilterData().SBU;  //get selected SBU
                this._sbu = 'VER'
                oModel.setHeaders({
                    sbu: this._sbu,
                    type: 'SALDOCDET',
                    tabname: 'ZERP_SALDOCDET'
                });
                await new Promise((resolve, reject) => {
                    oModel.read("/ColumnsSet", {
                        success: function (oData, oResponse) {
                            me._aColumns["salDocDetDynTable"] = oData.results;
                            oJSONColumnsModel.setData(oData);
                            me.oJSONModel.setData(oData);
                            me.getView().setModel(oJSONColumnsModel, "DetDynColumns");  //set the view model
                            me.getDynamicTableData(oData.results);
                            resolve();
                        },
                        error: function (err) { }
                    });
                })
            },

            getDynamicTableData: async function (columns) {
                var me = this;
                var oModel = this.getOwnerComponent().getModel();
                var oJSONDataModel = new sap.ui.model.json.JSONModel();

                var salesDocNo = this._salesDocNo;

                var oText = this.getView().byId("SalesDocDetCount");

                await new Promise((resolve, reject) => {
                    oModel.read("/SALDOCDETSet", {
                        urlParameters: {
                            "$filter": "SALESDOCNO eq '" + salesDocNo + "'"
                        },
                        success: function (oData, oResponse) {
                            oData.results.forEach(item => {
                                item.CPODT = dateFormat.format(item.CPODT);
                                item.DLVDT = dateFormat.format(item.DLVDT);
                                item.CREATEDTM = timeFormat.format(new Date(item.CREATEDTM.ms + TZOffsetMs));
                                item.UPDATEDTM = timeFormat.format(new Date(item.UPDATEDTM.ms + TZOffsetMs));
                                item.CREATEDDT = dateFormat.format(item.CREATEDDT);
                                item.UPDATEDDT = dateFormat.format(item.UPDATEDDT);
                            })
                            // oText.setText(oData.Results.length + "");
                            oJSONDataModel.setData(oData);
                            me.getView().setModel(oJSONDataModel, "DetDataModel");
                            me.setTableData();
                            me.setChangeStatus(false);
                        },
                        error: function (err) { }
                    });
                });
            },

            setTableData: function () {
                var me = this;

                //the selected dynamic columns
                var oDetColumnsModel = this.getView().getModel("DetDynColumns");
                var oDetDataModel = this.getView().getModel("DetDataModel");

                //the selected styles data
                var oDetColumnsData = oDetColumnsModel.getProperty('/results');
                var oDetData = oDetDataModel.getProperty('/results');

                // //add column for copy button
                // oColumnsData.unshift({
                //     "ColumnName": "Copy",
                //     "ColumnType": "COPY",
                //     "Visible": false
                // });

                //add column for manage button
                // oDetColumnsData.unshift({
                //     "ColumnName": "ManageDet",
                //     "ColumnType": "SEL"
                // });

                //set the column and data model
                var oModel2 = new JSONModel();
                oModel2.setData({
                    columns: oDetColumnsData,
                    rows: oDetData
                });

                var oDelegateKeyUp = {
                    onkeyup: function (oEvent) {
                        that.onkeyup(oEvent);
                    }
                };

                this.byId("salDocDetDynTable").addEventDelegate(oDelegateKeyUp);

                var oDetTable = this.getView().byId("salDocDetDynTable");
                oDetTable.setModel(oModel2);

                //bind the dynamic column to the table
                oDetTable.bindColumns("/columns", function (index, context) {
                    var sColumnId = context.getObject().ColumnName;
                    var sColumnLabel = context.getObject().ColumnLabel;
                    var sColumnType = context.getObject().ColumnType;
                    var sColumnWidth = context.getObject().ColumnWidth;
                    var sColumnVisible = context.getObject().Visible;
                    var sColumnSorted = context.getObject().Sorted;
                    var sColumnSortOrder = context.getObject().SortOrder;
                    return new sap.ui.table.Column({
                        id: sColumnId + "-Det",
                        label: sColumnLabel, //"{i18n>" + sColumnId + "}",
                        template: me.columnTemplate(sColumnId, sColumnType),
                        width: me.getFormatColumnSize(sColumnId, sColumnType, sColumnWidth) + 'px',
                        sortProperty: sColumnId,
                        filterProperty: sColumnId,
                        autoResizable: true,
                        visible: sColumnVisible,
                        sorted: sColumnSorted,
                        sortOrder: ((sColumnSorted === true) ? sColumnSortOrder : "Ascending")
                    });
                });

                //date/number sorting
                oDetTable.attachSort(function(oEvent) {
                    var sPath = oEvent.getParameter("column").getSortProperty();
                    var bDescending = false;
                    
                    //remove sort icon of currently sorted column
                    oDetTable.getColumns().forEach(col => {
                        if (col.getSorted()) {
                            col.setSorted(false);
                        }
                    })

                    oEvent.getParameter("column").setSorted(true); //sort icon initiator

                    if (oEvent.getParameter("sortOrder") === "Descending") {
                        bDescending = true;
                        oEvent.getParameter("column").setSortOrder("Descending") //sort icon Descending
                    }
                    else {
                        oEvent.getParameter("column").setSortOrder("Ascending") //sort icon Ascending
                    }

                    var oSorter = new sap.ui.model.Sorter(sPath, bDescending ); //sorter(columnData, If Ascending(false) or Descending(True))
                    var oColumn = oDetColumnsData.filter(fItem => fItem.ColumnName === oEvent.getParameter("column").getProperty("sortProperty"));
                    var columnType = oColumn[0].DataType;

                    if (columnType === "DATETIME") {
                        oSorter.fnCompare = function(a, b) {
                            // parse to Date object
                            var aDate = new Date(a);
                            var bDate = new Date(b);

                            if (bDate === null) { return -1; }
                            if (aDate === null) { return 1; }
                            if (aDate < bDate) { return -1; }
                            if (aDate > bDate) { return 1; }

                            return 0;
                        };
                    }
                    else if (columnType === "NUMBER") {
                        oSorter.fnCompare = function(a, b) {
                            // parse to Date object
                            var aNumber = +a;
                            var bNumber = +b;

                            if (bNumber === null) { return -1; }
                            if (aNumber === null) { return 1; }
                            if (aNumber < bNumber) { return -1; }
                            if (aNumber > bNumber) { return 1; }

                            return 0;
                        };
                    }
                    
                    oDetTable.getBinding('rows').sort(oSorter);
                    // prevent internal sorting by table
                    oEvent.preventDefault();
                });

                //bind the data to the table
                oDetTable.bindRows("/rows");
                TableFilter.updateColumnMenu("salDocDetDynTable", me);
            },

            columnTemplate: function (sColumnId, sColumnType) {
                var me = this;
                var oDetColumnTemplate;

                //different component based on field

                oDetColumnTemplate = new sap.m.Text({ text: "{" + sColumnId + "}", wrapping: false }); //default text

                if(sColumnId === "UOM" || sColumnId === "CUSTSHIPTO" || sColumnId === "PRODUCTTYP"){
                    var columnnName = sColumnId;
                    oDetColumnTemplate.bindText({
                        parts: [  
                            { path: sColumnId }
                        ],  
                        formatter: function(sColumnId) {
                            if(me.getView().getModel("onSugg"+ columnnName +"") !== undefined){
                                var oValue = me.getView().getModel("onSugg"+ columnnName +"").getData().filter(v => v[columnnName] === sColumnId);
                            
                                if (oValue && oValue.length > 0) {
                                    return oValue[0].Desc + " (" + sColumnId + ")";
                                }
                                else return sColumnId;
                            }
                            else return sColumnId;
                        }
                    })
                }

                

                if (sColumnId === "DELETED") {
                    //Manage button
                    oDetColumnTemplate = new sap.m.CheckBox({
                        selected: "{" + sColumnId + "}",
                        editable: false
                    });
                }
                return oDetColumnTemplate;
            },

            getColumnSize: function (sColumnId, sColumnType) {
                //column width of fields
                var mSize = '100';
                if (sColumnType === "SEL") {
                    mSize = '50';
                } else if (sColumnType === "COPY") {
                    mSize = '50';
                } else if (sColumnId === "STYLECD") {
                    mSize = '100';
                } else if (sColumnId === "DESC1" || sColumnId === "PRODTYP") {
                    mSize = '200';
                } else if (sColumnId === "DLVDT" || sColumnId === "DOCDT" || sColumnId === "CREATEDDT" || sColumnId === "UPDATEDDT") {
                    mSize = '100';
                }
                return mSize;
            },

            getFormatColumnSize: function (sColumnId, sColumnType, sColumnSize) {
                //column width of fields
                var mSize = sColumnSize;
                if (sColumnType === "SEL") {
                    mSize = '50';
                } else if (sColumnType === "COPY") {
                    mSize = '50';
                }
                // else if (sColumnId === "STYLECD") {
                //     mSize = '25';
                // } else if (sColumnId === "DESC1" || sColumnId === "PRODTYP") {
                //     mSize = '15';
                // } else if (sColumnId === "DLVDT" || sColumnId === "DOCDT" || sColumnId === "CREATEDDT" || sColumnId === "UPDATEDDT") {
                //     mSize = '30';
                // }
                return mSize;
            },

            setChangeStatus: function (changed) {
                //controls the edited warning message
                try {
                    sap.ushell.Container.setDirtyFlag(changed);
                } catch (err) { }
            },

            getHeaderConfig: async function () {
                var me = this;
                var oView = this.getView();
                var oModel = this.getOwnerComponent().getModel();

                //get header fields
                oModel.setHeaders({
                    sbu: this._sbu,
                    type: 'SALDOCHDR',
                    userid: this._userid
                });
                await new Promise((resolve, reject) => {
                    oModel.read("/DynamicColumnsSet", {
                        success: function (oData, oResponse) {
                            //Store List of Visible Fields
                            var oJSONVisible = new JSONModel();
                            var visibleFields = [];

                            //store List of Editable Fields
                            var oJSONEdit = new JSONModel();
                            var edditableFields = [];

                            //store List of Mandatory Fields
                            var oJSONMandatory = new JSONModel();
                            var mandatoryFields = [];

                            for (var i = 0; i < oData.results.length; i++) {
                                visibleFields[oData.results[i].ColumnName] = oData.results[i].Visible;
                                edditableFields[oData.results[i].ColumnName] = false;
                                mandatoryFields[oData.results[i].ColumnName] = oData.results[i].Mandatory;
                            }

                            oJSONVisible.setData(visibleFields);
                            oView.setModel(oJSONVisible, "VisibleFieldsData");

                            oJSONEdit.setData(edditableFields);
                            oView.setModel(oJSONEdit, "HeaderEditModeModel");

                            oJSONMandatory.setData(mandatoryFields);
                            oView.setModel(oJSONMandatory, "MandatoryFieldsData");
                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });

            },

            getHeaderData: async function () {
                var me = this;
                var salesDocNo = this._salesDocNo;
                var oModel = this.getOwnerComponent().getModel();
                var oJSONModel = new JSONModel();

                var oView = this.getView();

                // read Style header data
                var entitySet = "/SALDOCHDRSet('" + salesDocNo + "')"
                await new Promise((resolve, reject) => {
                    oModel.read(entitySet, {
                        success: function (oData, oResponse) {
                            // oData.forEach(item => {
                            oData.DOCDT = dateFormat.format(oData.DOCDT);
                            oData.CPODT = dateFormat.format(oData.CPODT);
                            oData.DLVDT = dateFormat.format(oData.DLVDT);
                            oData.CREATEDDT = dateFormat.format(oData.CREATEDDT);
                            oData.UPDATEDDT = dateFormat.format(oData.UPDATEDDT);
                            // })
                            oJSONModel.setData(oData);
                            oView.setModel(oJSONModel, "headerData");
                            me.setChangeStatus(false);
                            resolve();
                        },
                        error: function () {
                            resolve();
                        }
                    })
                })

            },

            handleFormValueHelp: function (oEvent) {
                TableValueHelp.handleFormValueHelp(oEvent, this);
            },

            setHeaderEditMode: async function () {
                //unlock editable fields of style header
                var oJSONModel = new JSONModel();
                this._headerChanged = false;

                var oDataEDitModel = this.getView().getModel("HeaderEditModeModel");
                var oDataEdit = oDataEDitModel.getProperty('/');
                var edditableFields = []
                if (await this.checkIfSalDocIsDeleted()) {
                    if (await this.checkIfSalDocIsEDI()) {
                        await this.getHeaderData();
                        for (var oDatas in oDataEdit) {
                            //get only editable fields
                            edditableFields[oDatas] = true;
                        }
                        edditableFields.SALESDOCNO = false
                        edditableFields.DELETED = false
                        edditableFields.EDISOURCE = false
                        edditableFields.SALESTERMTEXT = false
                        // edditableFields.SALESDOCTYP = false

                        // data.editMode = true;
                        oJSONModel.setData(edditableFields);
                        this.getView().setModel(oJSONModel, "HeaderEditModeModel");
                        // this.getView().setModel(oJSONModel, "headerData");

                        /*Check if Customer Group is not empty and check if SoldCust and BillCust will have 
                        suggestion items based on Customer Group for Sold To Customer and Sold to Customer for Bill to Customer */
                        await this.validateIfSoldCustAndBillCustHasValue();

                        this.byId("btnHdrEdit").setVisible(false);
                        this.byId("btnHdrDelete").setVisible(false);
                        this.byId("btnHdrClose").setVisible(false);
                        this.disableOtherTabs("itbDetail");

                        this.byId("btnHdrSave").setVisible(true);
                        this.byId("btnHdrCancel").setVisible(true);
                        await this.setReqField(true);
                    }else{
                        MessageBox.error("Sales Doc. is EDI PO!");
                    }
                } else {
                    MessageBox.error("Sales Doc. is already Deleted!");
                }
            },

            setNewHeaderEditMode: async function () {
                //unlock editable fields of style header
                await this.setReqField(true);
                var oJSONModel = new JSONModel();
                this._headerChanged = false;

                var oDataEDitModel = this.getView().getModel("HeaderEditModeModel");
                var oDataEdit = oDataEDitModel.getProperty('/');
                var edditableFields = []
                var oDataJSONModel = new JSONModel();

                for (var oDatas in oDataEdit) {
                    //get only editable fields
                    edditableFields[oDatas] = true;
                }
                edditableFields.SALESDOCNO = false
                edditableFields.DELETED = false
                edditableFields.EDISOURCE = false
                edditableFields.SALESTERMTEXT = false
                // edditableFields.SALESDOCTYP = false

                // data.editMode = true;
                oJSONModel.setData(edditableFields);
                this.getView().setModel(oJSONModel, "HeaderEditModeModel");
                this.getView().setModel(oDataJSONModel, "headerData");

                this.byId("btnHdrEdit").setVisible(false);
                this.byId("btnHdrDelete").setVisible(false);
                this.byId("btnHdrClose").setVisible(false);
                this.disableOtherTabs("itbDetail");

                this.byId("btnHdrSave").setVisible(true);
                this.byId("btnHdrCancel").setVisible(true);
            },

            checkIfSalDocIsDeleted: async function () {
                await this.getHeaderData();
                var oDataHdrModel = this.getView().getModel("headerData");
                var oDataHdrData = oDataHdrModel.getProperty('/');
                if (!oDataHdrData.DELETED) {
                    return true;
                } else {
                    return false;
                }
            },

            checkIfSalDocIsEDI: async function () {
                await this.getHeaderData();
                var oDataHdrModel = this.getView().getModel("headerData");
                var oDataHdrData = oDataHdrModel.getProperty('/');
                if (!oDataHdrData.EDISOURCE) {
                    return true;
                } else {
                    return false;
                }
            },

            checkIfSalDocHasIO: function(){
                var oTable = this.byId("salDocDetDynTable");
                var oSelectedIndices = oTable.getBinding("rows").aIndices;
                var oTmpSelectedIndices = [];
                var aData = oTable.getModel().getData().rows;

                var hasIO = false;

                oSelectedIndices.forEach(item => {
                    oTmpSelectedIndices.push(oTable.getBinding("rows").aIndices[item])
                })
    
                oSelectedIndices = oTmpSelectedIndices;

                for(var item in oSelectedIndices){
                    if(!hasIO){
                        if(!aData.at(item).DELETED){
                            if(aData.at(item).IONO !== "" && aData.at(item).IONO !== null && aData.at(item).IONO !== undefined){
                                hasIO = true;
                            }
                        }
                    }
                }

                return hasIO;

            },

            // setDetailVisible: function(bool) {
            //     var detailPanel = this.getView().byId('detailPanel'); //show detail section if there is header info
            //     detailPanel.setVisible(bool);
            // },
            onSaveHeader: async function () {
                var me = this;
                var oDataEDitModel = this.getView().getModel("headerData");
                var oDataEdit = oDataEDitModel.getProperty('/');

                var oParamData = [];
                var bProceed = true;
                var bError = false;

                var oModel = this.getOwnerComponent().getModel();

                //Init Validation Errors Object
                this._validationErrors = [];

                var oView = this.getView();
                var formView = this.getView().byId("SalesDocHeaderForm1"); //Form View
                var formContainers = formView.getFormContainers(); // Form Container
                var formElements = ""; //Form Elements
                var formFields = ""; // Form Field
                var formElementsIsVisible = false; //is Form Element Visible Boolean
                var fieldIsEditable = false; // is Field Editable Boolean
                var fieldMandatory = ""; // Field Mandatory variable
                var fieldIsMandatory = false; // Is Field Mandatory Boolean
                var oMandatoryModel = oView.getModel("MandatoryFieldsData").getProperty("/");

                //Form Validations
                //Iterate Form Containers
                for (var index in formContainers) {
                    formElements = formContainers[index].getFormElements(); //get Form Elements

                    //iterate Form Elements
                    for (var elementIndex in formElements) {
                        formElementsIsVisible = formElements[elementIndex].getProperty("visible"); //get the property Visible of Element
                        if (formElementsIsVisible) {
                            formFields = formElements[elementIndex].getFields(); //get FIelds in Form Element

                            //Iterate Fields
                            for (var formIndex in formFields) {
                                fieldMandatory = formFields[formIndex].getBindingInfo("value") === undefined ? "" : formFields[formIndex].getBindingInfo("value").mandatory;

                                fieldIsMandatory = oMandatoryModel[fieldMandatory] === undefined ? false : oMandatoryModel[fieldMandatory];

                                if (fieldIsMandatory) {
                                    fieldIsEditable = formFields[formIndex].getProperty("editable"); //get the property Editable of Fields
                                    if (fieldIsEditable) {
                                        if (formFields[formIndex].getValue() === "" || formFields[formIndex].getValue() === null || formFields[formIndex].getValue() === undefined) {
                                            formFields[formIndex].setValueState("Error");
                                            formFields[formIndex].setValueStateText("Required Field!");
                                            me._validationErrors.push(formFields[formIndex].getId())
                                            bProceed = false;
                                        } else {
                                            if(formFields[formIndex].isA("sap.m.Input")){
                                                if(formFields[formIndex].getSuggestionItems().length > 0){
                                                    formFields[formIndex].getSuggestionItems().forEach(item => {
                                                        if (item.getProperty("key") === formFields[formIndex].getSelectedKey() || item.getProperty("key") === formFields[formIndex].getValue().trim()) {
                                                            formFields[formIndex].setValueState("None");
                                                            me._validationErrors.forEach((item, index) => {
                                                                if (item === formFields[formIndex].getId()) {
                                                                    me._validationErrors.splice(index, 1)
                                                                }
                                                            })
                                                        }
                                                    })
                                                }else{
                                                    formFields[formIndex].setValueState("None");
                                                    me._validationErrors.forEach((item, index) => {
                                                        if (item === formFields[formIndex].getId()) {
                                                            me._validationErrors.splice(index, 1)
                                                        }
                                                    })
                                                }
                                            }else{
                                                formFields[formIndex].setValueState("None");
                                                me._validationErrors.forEach((item, index) => {
                                                    if (item === formFields[formIndex].getId()) {
                                                        me._validationErrors.splice(index, 1)
                                                    }
                                                })
                                            }
                                            
                                            // formFields[formIndex].setValueState("None");
                                            // me._validationErrors.forEach((item, index) => {
                                            //     if (item === formFields[formIndex].getId()) {
                                            //         me._validationErrors.splice(index, 1)
                                            //     }
                                            // })
                                        }
                                    }
                                }
                            }
                        }
                    }

                }

                if (this._validationErrors.length > 0) {
                    // MessageBox.error(this.getView().getModel("captionMsg").getData()["INFO_FILL_REQUIRED_FIELDS"]);
                    MessageBox.error("Please Fill Required Fields!");
                    bProceed = false;
                }

                if (bProceed) {
                    if (oDataEdit.SALESDOCTYP === undefined || oDataEdit.SALESDOCTYP === "") {
                        MessageBox.error("Sales Doc. Type cannot be empty!");
                        bProceed = false;
                    }

                    if (bProceed) {
                        Common.openLoadingDialog(that);
                        if (this.getView().getModel("ui").getData().Mode === "UPDATE") {

                            oParamData = {
                                SALESDOCNO: oDataEdit.SALESDOCNO,
                                SALESDOCTYP: oDataEdit.SALESDOCTYP,
                                DOCDT: oDataEdit.DOCDT !== "" ? sapDateFormat.format(new Date(oDataEdit.DOCDT)) + "T00:00:00" : null,
                                SALESORG: oDataEdit.SALESORG,
                                CUSTGRP: oDataEdit.CUSTGRP,
                                CUSTSOLDTO: oDataEdit.CUSTSOLDTO,
                                CUSTBILLTO: oDataEdit.CUSTBILLTO,
                                DSTCHAN: oDataEdit.DSTCHAN,
                                DIVISION: oDataEdit.DIVISION,
                                SALESGRP: oDataEdit.SALESGRP,
                                PAYMENTHODCD: oDataEdit.PAYMENTHODCD,
                                PAYTERMCD: oDataEdit.PAYTERMCD,
                                PURTAXCD: oDataEdit.PURTAXCD,
                                SALESTERM: oDataEdit.SALESTERM,
                                SALESTERMTEXT: oDataEdit.SALESTERMTEXT,
                                CURRENCYCD: oDataEdit.CURRENCYCD,
                                CPONO: oDataEdit.CPONO,
                                CPOREV: +oDataEdit.CPOREV,
                                CPODT: oDataEdit.CPODT === "" ? null : sapDateFormat.format(new Date(oDataEdit.CPODT)) + "T00:00:00",
                                DLVDT: oDataEdit.DLVDT === "" ? null : sapDateFormat.format(new Date(oDataEdit.DLVDT)) + "T00:00:00",
                                SEASONCD: oDataEdit.SEASONCD,
                                STATUS: "NEW",//oDataEdit.STATUS,
                                REMARKS: oDataEdit.REMARKS,
                                EDISOURCE: oDataEdit.EDISOURCE,
                                DELETED: oDataEdit.DELETED,
                                CUSTSEASON: oDataEdit.CUSTSEASON
                            }
                            _promiseResult = new Promise((resolve, reject) => {
                                oModel.update("/SALDOCHDRSet(SALESDOCNO='" + oDataEdit.SALESDOCNO + "')", oParamData, {
                                    method: "PUT",
                                    success: function (oData, oResponse) {
                                        resolve();
                                    }, error: function (error) {
                                        bError = true;
                                        resolve()
                                    }
                                })
                            });
                            await _promiseResult;
                        } else if (this.getView().getModel("ui").getData().Mode === "NEW") {
                            oParamData = {
                                SALESDOCNO: "NEW",
                                SALESDOCTYP: oDataEdit.SALESDOCTYP,
                                DOCDT: oDataEdit.DOCDT !== "" ? sapDateFormat.format(new Date(oDataEdit.DOCDT)) + "T00:00:00" : null,
                                SALESORG: oDataEdit.SALESORG,
                                CUSTGRP: oDataEdit.CUSTGRP,
                                CUSTSOLDTO: oDataEdit.CUSTSOLDTO,
                                CUSTBILLTO: oDataEdit.CUSTBILLTO,
                                DSTCHAN: oDataEdit.DSTCHAN,
                                DIVISION: oDataEdit.DIVISION,
                                SALESGRP: oDataEdit.SALESGRP,
                                PAYMENTHODCD: oDataEdit.PAYMENTHODCD,
                                PAYTERMCD: oDataEdit.PAYTERMCD,
                                PURTAXCD: oDataEdit.PURTAXCD,
                                SALESTERM: oDataEdit.SALESTERM,
                                SALESTERMTEXT: oDataEdit.SALESTERMTEXT,
                                CURRENCYCD: oDataEdit.CURRENCYCD,
                                CPONO: oDataEdit.CPONO,
                                CPOREV: +oDataEdit.CPOREV,
                                CPODT: oDataEdit.CPODT !== undefined ? sapDateFormat.format(new Date(oDataEdit.CPODT)) + "T00:00:00" : null,
                                DLVDT: oDataEdit.DLVDT !== undefined ? sapDateFormat.format(new Date(oDataEdit.DLVDT)) + "T00:00:00" : null,
                                SEASONCD: oDataEdit.SEASONCD,
                                STATUS: "NEW",//oDataEdit.STATUS,
                                REMARKS: oDataEdit.REMARKS,
                                EDISOURCE: oDataEdit.EDISOURCE,
                                DELETED: oDataEdit.DELETED,
                                CUSTSEASON: oDataEdit.CUSTSEASON
                            }
                            _promiseResult = new Promise((resolve, reject) => {
                                oModel.setHeaders({
                                    SBU: me._sbu
                                });
                                oModel.create("/SALDOCHDRSet", oParamData, {
                                    method: "POST",
                                    success: async function (oData, oResponse) {
                                        me._salesDocNo = oData.SALESDOCNO;

                                        await me.lock(me);
                                        //Load header
                                        await me.getHeaderConfig(); //get visible header fields
                                        await me.getView().getModel("ui").setProperty("/Mode", 'UPDATE');
                                        await me.getHeaderData(); //get header data
                                        await me.cancelHeaderEdit();
                                        await me.getDynamicTableColumns();
                                        resolve();
                                    }, error: function (error) {
                                        bError = true;
                                        resolve()
                                    }
                                })
                            });
                            await _promiseResult;
                        }

                        if (!bError) {
                            this.byId("btnHdrEdit").setVisible(true);
                            this.byId("btnHdrDelete").setVisible(true);
                            this.byId("btnHdrClose").setVisible(true);

                            //trigger suggestion items to load the customer ship to based on Header CUSTSOLDTO
                            await this.onSuggestionItems_CUSTSHIPTO();
                            this.enableOtherTabs("itbDetail");

                            this.byId("btnHdrSave").setVisible(false);
                            this.byId("btnHdrCancel").setVisible(false);
                            await this.closeHeaderEdit();
                        }

                        Common.closeLoadingDialog(that);
                    }
                }
            },

            lock: async (me) => {
                console.log("Lock:");
                var oModelLock = me.getOwnerComponent().getModel("ZGW_3DERP_LOCK_SRV");
                var oParamLock = {};
                var oSALDOC_TAB = [];
                var sError = "";

                oSALDOC_TAB.push({
                    "Salesdocno": me._salesDocNo,
                    "Lock": "X"
                })

                oParamLock["SALDOC_TAB"] = oSALDOC_TAB;
                oParamLock["Iv_Count"] = 300;
                oParamLock["SALDOC_MSG"] = [];

                console.log(oParamLock);
                // return;
                var promise = new Promise((resolve, reject) => {
                    oModelLock.create("/ZERP_SALDOCHDR", oParamLock, {
                        method: "POST",
                        success: function (oResultLock) {
                            console.log(oResultLock);
                            oResultLock.SALDOC_MSG.results.forEach(item => {
                                // if (item.Type === "S") {
                                    me.getView().getModel("ui").setProperty("/LockType", item.Type);
                                    me.getView().getModel("ui").setProperty("/LockMessage", item.Message);
                                    // alert(me.getView().getModel("ui").getProperty("/isLocked"));
                                // }
                                sError += item.Message + ".\r\n ";
                            })

                            if (sError.length > 0) {
                                resolve(false);
                                // sap.m.MessageBox.information(sError);
                                // me.closeLoadingDialog();
                            }
                            else resolve(true);
                        },
                        error: function (err) {
                            // me.closeLoadingDialog();
                            resolve(false);
                        }
                    });
                })

                return await promise;
            },

            cancelHeaderEdit: async function () {
                if(this._salesDocNo === "NEW"){
                    var oHistory = History.getInstance();
                    var sPreviousHash = oHistory.getPreviousHash();
                    await this.setReqField(false);

                    if (sPreviousHash !== undefined) {
                        window.history.go(-1);
                    } else {
                        var oRouter = this.getOwnerComponent().getRouter();
                        oRouter.navTo("Routesaldocinit", {}, true);
                    }
                }else{
                    //confirm cancel edit of style header
                    if (this._headerChanged) {
                        if (!this._DiscardHeaderChangesDialog) {
                            this._DiscardHeaderChangesDialog = sap.ui.xmlfragment("zuisaldoc2.zuisaldoc2.view.fragments.dialog.DiscardHeaderChanges", this);
                            this.getView().addDependent(this._DiscardHeaderChangesDialog);
                        }
                        jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), this._LoadingDialog);
                        this._DiscardHeaderChangesDialog.addStyleClass("sapUiSizeCompact");
                        this._DiscardHeaderChangesDialog.open();
                    } else {
                        this.byId("btnHdrEdit").setVisible(this.getView().getModel("ui").getProperty("/DisplayMode") === "display" ? false : true);
                        this.byId("btnHdrDelete").setVisible(this.getView().getModel("ui").getProperty("/DisplayMode") === "display" ? false : true);
                        this.enableOtherTabs("itbDetail");

                        this.byId("btnHdrSave").setVisible(false);
                        this.byId("btnHdrCancel").setVisible(false);
                        await this.setReqField(false);
                        await this.closeHeaderEdit();
                    }
                }
            },

            closeHeaderEdit: async function () {
                //on cancel confirmed - close edit mode and reselect backend data
                var oJSONModel = new JSONModel();
                that._headerChanged = false;
                that.setChangeStatus(false);

                var oDataEDitModel = this.getView().getModel("HeaderEditModeModel");
                var oDataEdit = oDataEDitModel.getProperty('/');
                var edditableFields = []

                for (var oDatas in oDataEdit) {
                    //get only editable fields
                    edditableFields[oDatas] = false;
                }

                oJSONModel.setData(edditableFields);
                that.getView().setModel(oJSONModel, "HeaderEditModeModel");
                if (that._DiscardHeaderChangesDialog) {
                    that._DiscardHeaderChangesDialog.close();
                }
                if (this.getView().getModel("ui").getData().Mode === "UPDATE") {
                    await that.getHeaderData();
                }
                var oMsgStrip = that.getView().byId('HeaderMessageStrip');
                oMsgStrip.setVisible(false);
            },

            onDeleteSalDoc: async function () {
                var me = this;
                var oDataEDitModel = this.getView().getModel("headerData");
                var oDataEdit = oDataEDitModel.getProperty('/');

                var oParamData = [];

                var oModel = this.getOwnerComponent().getModel();

                if (await this.checkIfSalDocIsDeleted()) {
                    if(!this.checkIfSalDocHasIO()){
                        var actionSel;
                        var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                         await new Promise((resolve, reject) => {
                            MessageBox.information(
                                "Are you sure you want to delete Sales Document No.: " + oDataEdit.SALESDOCNO + "?",
                                {
                                    actions: ["Yes", "No"],
                                    styleClass: bCompact ? "sapUiSizeCompact" : "",
                                    onClose: function (sAction) {
                                        actionSel = sAction;
                                        resolve(actionSel);
                                    }
                                }
                            );
                        })
                        if (actionSel === "Yes") {
                            Common.openLoadingDialog(that);
                            oParamData = {
                                SALESDOCNO: oDataEdit.SALESDOCNO,
                                SALESDOCTYP: oDataEdit.SALESDOCTYP,
                                DOCDT: oDataEdit.DOCDT !== "" ? sapDateFormat.format(new Date(oDataEdit.DOCDT)) + "T00:00:00" : null,
                                SALESORG: oDataEdit.SALESORG,
                                CUSTGRP: oDataEdit.CUSTGRP,
                                CUSTSOLDTO: oDataEdit.CUSTSOLDTO,
                                CUSTBILLTO: oDataEdit.CUSTBILLTO,
                                DSTCHAN: oDataEdit.DSTCHAN,
                                DIVISION: oDataEdit.DIVISION,
                                SALESGRP: oDataEdit.SALESGRP,
                                PAYMENTHODCD: oDataEdit.PAYMENTHODCD,
                                PAYTERMCD: oDataEdit.PAYTERMCD,
                                PURTAXCD: oDataEdit.PURTAXCD,
                                SALESTERM: oDataEdit.SALESTERM,
                                SALESTERMTEXT: oDataEdit.SALESTERMTEXT,
                                CURRENCYCD: oDataEdit.CURRENCYCD,
                                CPONO: oDataEdit.CPONO,
                                CPOREV: +oDataEdit.CPOREV,
                                CPODT: oDataEdit.CPODT !== "" ? sapDateFormat.format(new Date(oDataEdit.CPODT)) + "T00:00:00" : null,
                                DLVDT: oDataEdit.DLVDT !== "" ? sapDateFormat.format(new Date(oDataEdit.DLVDT)) + "T00:00:00" : null,
                                SEASONCD: oDataEdit.SEASONCD,
                                STATUS: oDataEdit.STATUS,
                                REMARKS: oDataEdit.REMARKS,
                                EDISOURCE: oDataEdit.EDISOURCE,
                                DELETED: true
                            }
                            _promiseResult = new Promise((resolve, reject) => {
                                oModel.update("/SALDOCHDRSet(SALESDOCNO='" + oDataEdit.SALESDOCNO + "')", oParamData, {
                                    method: "PUT",
                                    success: function (oData, oResponse) {
                                        resolve();
                                    }, error: function (error) {
                                        MessageBox.error(error);
                                        resolve()
                                    }
                                })
                            });
                            await _promiseResult;
                            await this.closeHeaderEdit();
                            Common.closeLoadingDialog(that);
                        } else if (actionSel === "Cancel") {
                            MessageBox.Action.CLOSE
                        }
                    }else{
                        MessageBox.error("Sales Doc. has IO Already!");
                    }
                } else {
                    MessageBox.error("Sales Doc. is already Deleted!");
                }

            },

            onClosePageSalDoc: function(){
                var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                oRouter.navTo("Routesaldocinit", {}, true);
            },

            onSalDocDetAdd: async function () {
                var me = this;

                var detailsItemArr = [];
                var detailsItemLastCnt = 0;
                var detailsItemObj = this._onBeforeDetailData;
                var newInsertField = [];
                if (await this.checkIfSalDocIsDeleted()) {
                    detailsItemObj = detailsItemObj.length === undefined ? [] : detailsItemObj;

                    for (var x = 0; x < detailsItemObj.length; x++) {
                        detailsItemArr.push(detailsItemObj[x]);
                    }
                    detailsItemArr.sort(function (a, b) { return b - a });
                    detailsItemLastCnt = isNaN(Object.keys(detailsItemArr).pop()) ? 0 : Object.keys(detailsItemArr).pop();

                    detailsItemLastCnt = String(parseInt(detailsItemLastCnt) + 1);

                    // for(var x = 0; x < detailsItemObj.length; x++){
                    //     detailsItemArr.push(detailsItemObj[x].Tdformat);
                    // }
                    // detailsItemArr.sort(function(a, b){return b - a});
                    // detailsItemLastCnt = isNaN(detailsItemArr[0]) ? 0 : detailsItemArr[0];

                    // detailsItemLastCnt = String(parseInt(detailsItemLastCnt) + 1);
                    for (var oDatas in detailsItemObj[0]) {
                        //get only editable fields
                        if (oDatas !== '__metadata')
                            newInsertField[oDatas] = "";
                    }
                    detailsItemObj.push(newInsertField);

                    this.getView().getModel("DetDataModel").setProperty("/results", detailsItemObj);
                    TableFilter.applyColFilters("salDocDetDynTable", me);
                    await this.setTableData();
                    this.byId("btnDetAdd").setVisible(true);
                    this.byId("btnDetEdit").setVisible(false);
                    this.byId("btnDetDelete").setVisible(false);
                    this.byId("btnDetDeleteEditRow").setVisible(true);
                    this.byId("btnDetSave").setVisible(true);
                    this.byId("btnDetCancel").setVisible(true);
                    // this.byId("btnDetCreateStyle").setVisible(false);
                    // this.byId("btnDetCreateIO").setVisible(false);
                    // this.byId("btnDetCreateStyleIO").setVisible(false);
                    this.byId("btnDetTabLayout").setVisible(false);
                    this.byId("TB1").setEnabled(false);
                    this.onRowEditSalDoc('salDocDetDynTable', 'DetDynColumns');

                    //Set Edit Mode
                    this.getView().getModel("ui").setProperty("/editMode", 'NEW');
                    // this.getView().setModel(detailsJSONModel, "remarksTblData");
                } else {
                    MessageBox.error("Sales Doc. is already Deleted!");
                }
            },

            onSalDocDetEdit: async function () {
                var me = this;
                var salDocNo;
                var salDocItem

                var oModel = this.getOwnerComponent().getModel();
                var oTable = this.byId("salDocDetDynTable");
                var aSelIndices = oTable.getSelectedIndices();
                var oTmpSelectedIndices = [];
                var aData = this.getView().getModel("DetDataModel").getData().results;
                var aDataToEdit = [];
                var iCounter = 0;
                var bProceed = true;
                                    
                //trigger suggestion items to load the customer ship to based on Header CUSTSOLDTO
                await this.onSuggestionItems_CUSTSHIPTO();
                if (await this.checkIfSalDocIsDeleted()) {
                    if(await this.checkIfSalDocIsEDI()){
                        if (aSelIndices.length > 0) {
                            aSelIndices.forEach(item => {
                                oTmpSelectedIndices.push(oTable.getBinding("rows").aIndices[item])
                            });

                            aSelIndices = oTmpSelectedIndices;
                            aSelIndices.forEach((item, index) => {
                                if (aData.at(item).DELETED === true) {
                                    iCounter++;
                                    if (aSelIndices.length === iCounter) {
                                        MessageBox.error("Sales Doc. Item Already Deleted");
                                    }
                                } else {
                                    salDocNo = aData.at(item).SALESDOCNO;
                                    salDocItem = aData.at(item).SALESDOCITEM;
                                    oModel.read("/SALDOCDETSet", {
                                        urlParameters: {
                                            "$filter": "SALESDOCNO eq '" + salDocNo + "'"
                                        },
                                        success: async function (oData, oResponse) {
                                            oData.results.forEach(item1 => {
                                                item1.CPODT = dateFormat.format(new Date(item1.CPODT));
                                                item1.DLVDT = dateFormat.format(new Date(item1.DLVDT));
                                                item1.CREATEDTM = timeFormat.format(new Date(item1.CREATEDTM.ms + TZOffsetMs));
                                                item1.UPDATEDTM = timeFormat.format(new Date(item1.UPDATEDTM.ms + TZOffsetMs));
                                                item1.CREATEDDT = dateFormat.format(new Date(item1.CREATEDDT));
                                                item1.UPDATEDDT = dateFormat.format(new Date(item1.UPDATEDDT));

                                                if (salDocItem === item1.SALESDOCITEM) {
                                                    iCounter++;
                                                    aDataToEdit.push(aData.at(item));
                                                    if (bProceed) {
                                                        if (aSelIndices.length === iCounter) {
                                                            me.getView().getModel("DetDataModel").setProperty("/results", aDataToEdit);
                                                            me.setTableData();

                                                            me.byId("btnDetAdd").setVisible(false);
                                                            me.byId("btnDetEdit").setVisible(false);
                                                            me.byId("btnDetDelete").setVisible(false);
                                                            me.byId("btnDetSave").setVisible(true);
                                                            me.byId("btnDetCancel").setVisible(true);
                                                            // me.byId("btnDetCreateStyle").setVisible(false);
                                                            // me.byId("btnDetCreateIO").setVisible(false);
                                                            // me.byId("btnDetCreateStyleIO").setVisible(false);
                                                            me.byId("btnDetTabLayout").setVisible(false);
                                                            me.byId("TB1").setEnabled(false);

                                                            //Set Edit Mode
                                                            me.getView().getModel("ui").setProperty("/editMode", 'UPDATE');

                                                            me.onRowEditSalDoc('salDocDetDynTable', 'DetDynColumns');
                                                        }
                                                    }
                                                }
                                            })
                                        },
                                        error: function (err) { }
                                    });
                                }
                            });
                        } else {
                            MessageBox.error("No data to edit.");
                        }
                    }else{
                        MessageBox.error("Sales Doc. is EDI PO!");
                    }
                } else {
                    MessageBox.error("Sales Doc. is already Deleted!");
                }

            },
            onRowEditSalDoc: async function (table, model) {
                var me = this;
                // this.getView().getModel(model).getData().results.forEach(item => item.Edited = false);
                var oTable = this.byId(table);

                var oColumnsModel = this.getView().getModel(model);
                var oColumnsData = oColumnsModel.getProperty('/results');

                oTable.getColumns().forEach((col, idx) => {
                    oColumnsData.filter(item => item.ColumnName === col.sId.split("-")[0])
                        .forEach(async ci => {
                            var sColumnName = ci.ColumnName;
                            var sColumnType = ci.DataType;
                            if (ci.Editable) {
                                if (ci.ColumnName === "UNLIMITED") {
                                    col.setTemplate(new sap.m.CheckBox({
                                        selected: "{" + ci.ColumnName + "}",
                                        editable: true,
                                        // liveChange: this.onInputLiveChange.bind(this)
                                    }));
                                } else if (sColumnType === "STRING") {
                                    if (sColumnName === "CUSTSTYLE" || sColumnName === "CUSTSTYLEDESC" || sColumnName === "CPONO" || sColumnName === "CUSTCOLOR"
                                        || sColumnName === "CUSTSIZE" || sColumnName === "PRODUCTCD" || sColumnName === "PRODUCTGRP"
                                        || sColumnName === "CUSTSHIPTOCD" || sColumnName === "CUSTSHIPTONM" || sColumnName === "CUSTCOLDESC" ) {
                                        col.setTemplate(new sap.m.Input({
                                            // id: "ipt" + ci.name,
                                            type: "Text",
                                            value: "{path: '" + ci.ColumnName + "', mandatory: " + ci.Mandatory + "}",
                                            maxLength: +ci.Length,
                                            showValueHelp: false,
                                            liveChange: this.onInputLiveChange.bind(this)
                                        }));
                                    } else {
                                        col.setTemplate(new sap.m.Input({
                                            // id: "ipt" + ci.name,
                                            type: "Text",
                                            value: {
                                                parts: [
                                                    { path: ci.ColumnName }, 
                                                    { value: "onSugg" + ci.ColumnName }, 
                                                    { value: 'Item' }, 
                                                    { value: 'Desc' }, 
                                                    { value: 'ValueKey' }
                                                ],
                                                formatter: this.formatValueHelp.bind(this),
                                                mandatory: ci.Mandatory
                                            },
                                            // value: "{path: '" + ci.ColumnName + "', mandatory: '" + ci.Mandatory + "'}",
                                            // maxLength: +ci.Length,
                                            textFormatMode: 'Value',
                                            showValueHelp: true,
                                            valueHelpRequest: TableValueHelp.handleTableValueHelp.bind(this),//this.handleValueHelp.bind(this),
                                            showSuggestion: true,
                                            suggestionItems: {
                                                path: 'onSugg' + ci.ColumnName + '>/',
                                                length: 10000,
                                                template: new sap.ui.core.ListItem({
                                                    key: '{onSugg' + ci.ColumnName + '>Item}',
                                                    text: '{onSugg' + ci.ColumnName + '>Desc} ({onSugg' + ci.ColumnName + '>Item})',
                                                    additionalText: '{onSugg' + ci.ColumnName + '>Item}'
                                                }),
                                                templateShareable: false
                                            },
                                            maxSuggestionWidth: "160px",
                                            change: this.onInputLiveChangeSuggestion.bind(this)
                                        }));
                                    }
                                } else if (sColumnType === "DATETIME") {
                                    col.setTemplate(new sap.m.DatePicker({
                                        // id: "ipt" + ci.name,
                                        value: "{path: '" + ci.ColumnName + "', mandatory: " + ci.Mandatory + "}",
                                        displayFormat: "short",
                                        change: this.onInputLiveChange.bind(this),

                                        liveChange: this.onInputLiveChange.bind(this)
                                    }));
                                } else if (sColumnType === "NUMBER") {
                                    col.setTemplate(new sap.m.Input({
                                        // id: "ipt" + ci.name,
                                        type: sap.m.InputType.Number,
                                        value: "{path:'" + ci.ColumnName + "', mandatory: " + ci.Mandatory + ", type:'sap.ui.model.type.Decimal', formatOptions:{ minFractionDigits:" + null + ", maxFractionDigits:" + null + " }, constraints:{ precision:" + ci.Decimal + ", scale:" + null + " }}",

                                        maxLength: +ci.Length,

                                        liveChange: this.onNumberLiveChange.bind(this)
                                    }));
                                }
                                if (ci.Mandatory) {
                                    col.getLabel().addStyleClass("sapMLabelRequired");
                                    col.getLabel().addStyleClass("requiredField");
                                }
                            }
                        });

                });
            },
            // onHeaderChange: async function (oEvent) {
            //     var oModelFilter = this.getOwnerComponent().getModel('ZVB_3DERP_SALDOC_FILTERS_CDS');
            //     var resultData = "";

            //     if (oEvent.getSource().getId().includes("SALESTERM")) {
            //         var salesTermVal = this.getView().byId("SALESTERM").getValue();
            //         var salesTermTxtLbl = this.getView().byId("SALESTERMTEXT");
            //         await new Promise((resolve, reject) => {
            //             oModelFilter.read('/ZVB_3D_INCTRM_SH', {
            //                 success: function (data, response) {
            //                     data.results.forEach(item => {
            //                         if (item.Inco1 === salesTermVal) {
            //                             resultData = item.DESCRIPTION;
            //                         }
            //                     })

            //                     salesTermTxtLbl.setValue(resultData);
            //                     resolve();
            //                 },
            //                 error: function (err) {
            //                     resolve();
            //                 }
            //             });
            //         });
            //     }
            //     if (oEvent.getSource().getBindingInfo("value").mandatory) {
            //         if (oEvent.getParameters().value === "") {
            //             oEvent.getSource().setValueState("Error");
            //             oEvent.getSource().setValueStateText("Required Field");
            //             this._validationErrors.push(oEvent.getSource().getId());
            //         } else {
            //             oEvent.getSource().setValueState("None");
            //             this._validationErrors.forEach((item, index) => {
            //                 if (item === oEvent.getSource().getId()) {
            //                     this._validationErrors.splice(index, 1)
            //                 }
            //             })
            //         }
            //     }
            //     if (oEvent.getParameters().value === oEvent.getSource().getBindingInfo("value").binding.oValue) {
            //         this._isEdited = false;
            //     } else {
            //         this._isEdited = true;
            //     }
            // },

            onInputLiveChange: function (oEvent) {
                var oMandatoryModel = this.getView().getModel("MandatoryFieldsData").getProperty("/");

                var fieldIsMandatory;
                if(oEvent.getSource().getParent().getId().includes("salDocDetDynTable")){
                    fieldIsMandatory = oEvent.getSource().getBindingInfo("value").mandatory;
                }else{
                    fieldIsMandatory = oMandatoryModel[oEvent.getSource().getBindingInfo("value").mandatory] === undefined ? false : oMandatoryModel[oEvent.getSource().getBindingInfo("value").mandatory];
                }
                if (fieldIsMandatory) {
                    if (oEvent.getParameters().value === "") {
                        oEvent.getSource().setValueState("Error");
                        oEvent.getSource().setValueStateText("Required Field");
                        this._validationErrors.push(oEvent.getSource().getId());
                    } else {
                        oEvent.getSource().setValueState("None");
                        this._validationErrors.forEach((item, index) => {
                            if (item === oEvent.getSource().getId()) {
                                this._validationErrors.splice(index, 1)
                            }
                        })
                    }
                }

                if (oEvent.getSource().getBindingInfo("value").mandatory === "true") {
                    if (oEvent.getParameters().value === "") {
                        oEvent.getSource().setValueState("Error");
                        oEvent.getSource().setValueStateText("Required Field");
                        this._validationErrors.push(oEvent.getSource().getId());
                    } else {
                        oEvent.getSource().setValueState("None");
                        this._validationErrors.forEach((item, index) => {
                            if (item === oEvent.getSource().getId()) {
                                this._validationErrors.splice(index, 1)
                            }
                        })
                    }
                }
            },

            onInputLiveChangeSuggestion: async function(oEvent){
                var oMandatoryModel = this.getView().getModel("MandatoryFieldsData").getProperty("/");
                var oSource = oEvent.getSource();
                var isInvalid = !oSource.getSelectedKey() && oSource.getValue().trim();

                oSource.setValueState(isInvalid ? "Error" : "None");
                oSource.setValueStateText("Invalid Entry");

                if(oSource.getId().includes("CUSTGRP")){
                    var custGrpHeaderData = this.getView().getModel("headerData").getData().CUSTGRP;
                    if(custGrpHeaderData !== undefined || custGrpHeaderData !== "" || custGrpHeaderData !== null){
                        if(oSource.getSelectedKey() !== custGrpHeaderData){
                            var sModel = oSource.getBindingInfo("value").parts[0].model;
                            var sPath = oSource.getBindingInfo("value").parts[0].path;
                            this.getView().getModel(sModel).setProperty("/CUSTSOLDTO", "");
                        }
                        this.getView().byId("CUSTSOLDTO").setEnabled(true);
                    }
                    if(oEvent.getParameters().value === "") {
                        var sModel = oSource.getBindingInfo("value").parts[0].model;
                        var sPath = oSource.getBindingInfo("value").parts[0].path;
                        this.getView().getModel(sModel).setProperty("/CUSTSOLDTO", "");
                        this.getView().byId("CUSTSOLDTO").setEnabled(false);
                    }
                    
                }

                if(oSource.getId().includes("CUSTSOLDTO")){
                    var custSoldTo = this.getView().getModel("headerData").getData().CUSTSOLDTO;
                    if(custSoldTo !== undefined || custSoldTo !== "" || custSoldTo !== null){
                        if(oSource.getSelectedKey() !== custSoldTo){
                            var sModel = oSource.getBindingInfo("value").parts[0].model;
                            var sPath = oSource.getBindingInfo("value").parts[0].path;
                            this.getView().getModel(sModel).setProperty("/CUSTBILLTO", "");
                        }
                        this.getView().byId("CUSTBILLTO").setEnabled(true);
                    }
                    if(oEvent.getParameters().value === "") {
                        var sModel = oSource.getBindingInfo("value").parts[0].model;
                        var sPath = oSource.getBindingInfo("value").parts[0].path;
                        this.getView().getModel(sModel).setProperty("/CUSTBILLTO", "");
                        this.getView().byId("CUSTBILLTO").setEnabled(false);
                    }
                    
                }

                if(oSource.getId().includes("SALESTERM")){
                    var fieldName = this.getView().getModel("headerData").getData().SALESTERM;
                    if(fieldName !== undefined || fieldName !== "" || fieldName !== null){
                        if(oSource.getSelectedKey() !== fieldName){
                            var sModel = oSource.getBindingInfo("value").parts[0].model;
                            var sPath = oSource.getBindingInfo("value").parts[0].path;
                            this.getView().getModel(sModel).setProperty("/SALESTERMTEXT", "");
                        }
                    }
                    if(oEvent.getParameters().value === "") {
                        var sModel = oSource.getBindingInfo("value").parts[0].model;
                        var sPath = oSource.getBindingInfo("value").parts[0].path;
                        this.getView().getModel(sModel).setProperty("/SALESTERMTEXT", "");
                    }
                    
                }
                // if(oSource.getId().includes("CUSTSOLDTO")){
                //     var custGrp = this.getView().byId("CUSTGRP").getSelectedKey();
                //     if(custGrp === "" || custGrp === null || custGrp === undefined){
                //         this.getView().byId("CUSTGRP").setValueState("Error");
                //         this.getView().byId("CUSTGRP").setValueStateText("Required Field!");
                //         oSource.setValue("");
                //         bProceed = false;
                //         MessageBox.error("Please Select Customer Group First!");
                //     }
                // }

                if(oSource.getSuggestionItems().length > 0){
                    oSource.getSuggestionItems().forEach(item => {
                        if (item.getProperty("key") === oSource.getSelectedKey() || item.getProperty("key") === oSource.getValue().trim()) {
                            isInvalid = false;
                            oSource.setValueState(isInvalid ? "Error" : "None");
                        }
                        if(oSource.getValue().trim() === item.getProperty("key")){

                            oSource.setSelectedKey(item.getProperty("key"));
                            isInvalid = false;
                            oSource.setValueState(isInvalid ? "Error" : "None");
                        }
                    })
                }else{
                    isInvalid = true;
                    oSource.setValueState(isInvalid ? "Error" : "None");
                    oSource.setValueStateText("Invalid Entry");
                }
                var fieldIsMandatory;
                if(oEvent.getSource().getParent().getId().includes("salDocDetDynTable")){
                    fieldIsMandatory = oEvent.getSource().getBindingInfo("value").mandatory;
                }else{
                    fieldIsMandatory = oMandatoryModel[oEvent.getSource().getBindingInfo("value").mandatory] === undefined ? false : oMandatoryModel[oEvent.getSource().getBindingInfo("value").mandatory];
                }
                if (fieldIsMandatory) {
                    if (oEvent.getParameters().value === "") {
                        isInvalid = true;
                        oSource.setValueState(isInvalid ? "Error" : "None");
                        oEvent.getSource().setValueStateText("Required Field");
                    }
                }

                if (isInvalid) {
                    this._validationErrors.push(oEvent.getSource().getId());
                }
                else {
                    if(oEvent.getSource().getParent().getId().includes("salDocDetDynTable")){
                        var oInput = oEvent.getSource();
                        var oCell = oInput.getParent();
                        // var oRow = oCell.getBindingContext().getObject();
                        var sPath = oCell.getBindingContext().getPath();
                        var sRowPath = sPath == undefined ? null :"/results/"+ sPath.split("/")[2];

                        var sCol = oSource.getBindingInfo("value").parts[0].path;
                        this.getView().getModel("DetDataModel").setProperty(sRowPath + "/" + sCol, oSource.getSelectedKey())
                    }else{
                        var sModel = oSource.getBindingInfo("value").parts[0].model;
                        var sPath = oSource.getBindingInfo("value").parts[0].path;
                        this.getView().getModel(sModel).setProperty(sPath, oSource.getSelectedKey());
                        if(oSource.getId().includes("CUSTGRP")){
                            this.onSuggestionItems_CUSTSOLDTO();
                        }

                        if(oSource.getId().includes("CUSTSOLDTO")){
                            this.onSuggestionItems_CUSTBILLTO();
                        }

                        if(oSource.getId().includes("SALESTERM")){
                            this.setValueToTextField(oSource.getSelectedKey(), "onSuggSalesTerm", "SALESTERMTEXT");
                        }
                    }
                    

                    this._validationErrors.forEach((item, index) => {
                        if (item === oEvent.getSource().getId()) {
                            this._validationErrors.splice(index, 1)
                        }
                    })
                }
            },

            setValueToTextField: async function(sKey, sModel, sFIeldName){
                var resultData = "";
                var textField = this.getView().byId(sFIeldName);

                var oSuggestionData = this.getView().getModel(sModel).getData();

                for(var item = 0; item < oSuggestionData.length; item++){
                    if(oSuggestionData[item].Item === sKey){
                        resultData = oSuggestionData[item].DESCRIPTION
                    }
                }
                textField.setValue(resultData);
            },

            onNumberLiveChange: function (oEvent) {
                if (oEvent.getSource().getBindingInfo("value").mandatory) {
                    if (oEvent.getParameters().value === "") {
                        oEvent.getSource().setValueState("Error");
                        oEvent.getSource().setValueStateText("Required Field");
                        this._validationErrors.push(oEvent.getSource().getId());
                    } else {
                        oEvent.getSource().setValueState("None");
                        this._validationErrors.forEach((item, index) => {
                            if (item === oEvent.getSource().getId()) {
                                this._validationErrors.splice(index, 1)
                            }
                        })
                    }
                }
            },
            onRowChange: async function (oEvent) {
                var sPath = oEvent.getParameter("rowContext");
                sPath = "/results/" + sPath.getPath().split("/")[2];
                var selPath = this.byId(oEvent.getParameters().id).mProperties.selectedIndex;

                var oTable = this.getView().byId("salDocDetDynTable");

                var oRow = this.getView().getModel("DetDataModel").getProperty(sPath)

                _promiseResult = new Promise((resolve, reject) => {
                    oTable.getRows().forEach(row => {
                        if (row.getBindingContext().sPath.replace("/rows/", "") === sPath.split("/")[2]) {
                            resolve(row.addStyleClass("activeRow"));
                        } else {
                            resolve(row.removeStyleClass("activeRow"));
                        }
                    });
                });
            },
            onCellClick: async function (oEvent) {
                var sRowPath = oEvent.getParameters().rowBindingContext.sPath;
                sRowPath = "/results/" + sRowPath.split("/")[2];
                var oRow = this.getView().getModel("DetDataModel").getProperty(sRowPath)
                var oTable = this.getView().byId("salDocDetDynTable");

                // salDocNotxt = oRow.SALESDOCNO;

                _promiseResult = new Promise((resolve, reject) => {
                    oTable.getRows().forEach(row => {
                        if (row.getBindingContext().sPath.replace("/rows/", "") === sRowPath.split("/")[2]) {
                            resolve(row.addStyleClass("activeRow"));
                        } else {
                            resolve(row.removeStyleClass("activeRow"));
                        }
                    });
                });
                await _promiseResult;

            },
            onkeyup: async function (oEvent) {
                if ((oEvent.key === "ArrowUp" || oEvent.key === "ArrowDown") && oEvent.srcControl.sParentAggregationName === "rows") {
                    var sRowPath = this.byId(oEvent.srcControl.sId).oBindingContexts["undefined"].sPath;
                    sRowPath = "/results/" + sRowPath.split("/")[2];
                    var index = sRowPath.split("/");
                    var oTable = this.byId("salDocDetDynTable");
                    var oRow = this.getView().getModel("DetDataModel").getProperty(sRowPath);

                    _promiseResult = new Promise((resolve, reject) => {
                        oTable.getRows().forEach(row => {
                            if (row.getBindingContext().sPath.replace("/rows/", "") === index[2]) {
                                resolve(row.addStyleClass("activeRow"));
                            } else {
                                resolve(row.removeStyleClass("activeRow"));
                            }
                        });
                    });
                    await _promiseResult;
                }
            },

            onSalDocDetSave: async function () {
                var me = this;

                //Get Edit Mode
                var type = this.getView().getModel("ui").getData().editMode;


                var oModel = this.getOwnerComponent().getModel();
                oModel.setUseBatch(true);
                oModel.setDeferredGroups(["update"]);
                var insertModelParameter = {
                    "groupId": "insert"
                };
                var updateModelParameter = {
                    "groupId": "update"
                };

                var oTable = this.byId("salDocDetDynTable");
                var oSelectedIndices = oTable.getBinding("rows").aIndices;
                var oTmpSelectedIndices = [];
                var aData = oTable.getModel().getData().rows;

                var oParamData = []

                var bProceed = true;
                Common.openLoadingDialog(that);

                oSelectedIndices.forEach(item => {
                    oTmpSelectedIndices.push(oTable.getBinding("rows").aIndices[item])
                })

                oSelectedIndices = oTmpSelectedIndices;
                var aItems = oTable.getRows();
                if(oSelectedIndices.length > 0){
                    aItems.forEach(function(oItem) {
                        oSelectedIndices.forEach((item, index) => {
                            if(oItem.getIndex() === item){
                                var aCells = oItem.getCells();
                                aCells.forEach(function(oCell) {
                                    if (oCell.isA("sap.m.Input")) {
                                        if(oCell.getBindingInfo("value").mandatory){
                                            if(oCell.getValue() === ""){
                                                oCell.setValueState(sap.ui.core.ValueState.Error);
                                                me._validationErrors.push(oCell.getId());
                                            }else{
                                                if(oCell.getSuggestionItems().length > 0){
                                                    oCell.getSuggestionItems().forEach(item => {
                                                        if (item.getProperty("key") === oCell.getSelectedKey() || item.getProperty("key") === oCell.getValue().trim()) {
                                                            oCell.setValueState("None");
                                                            me._validationErrors.forEach((item, index) => {
                                                                if (item === oCell.getId()) {
                                                                    me._validationErrors.splice(index, 1)
                                                                }
                                                            })
                                                        }
                                                    })
                                                }else{
                                                    oCell.setValueState("None");
                                                    me._validationErrors.forEach((item, index) => {
                                                        if (item === oCell.getId()) {
                                                            me._validationErrors.splice(index, 1)
                                                        }
                                                    })
                                                }

                                                // oCell.setValueState(sap.ui.core.ValueState.None);
                                                // me._validationErrors.forEach((item, index) => {
                                                //     if (item === oCell.getId()) {
                                                //         me._validationErrors.splice(index, 1)
                                                //     }
                                                // })
                                            }
                                        }else{
                                            if(oCell.getSuggestionItems().length > 0){
                                                oCell.getSuggestionItems().forEach(item => {
                                                    if (item.getProperty("key") === oCell.getSelectedKey() || item.getProperty("key") === oCell.getValue().trim()) {
                                                        oCell.setValueState("None");
                                                        me._validationErrors.forEach((item, index) => {
                                                            if (item === oCell.getId()) {
                                                                me._validationErrors.splice(index, 1)
                                                            }
                                                        })
                                                    }
                                                })
                                            }else{
                                                oCell.setValueState("None");
                                                me._validationErrors.forEach((item, index) => {
                                                    if (item === oCell.getId()) {
                                                        me._validationErrors.splice(index, 1)
                                                    }
                                                })
                                            }
                                        }
                                    }else if (oCell.isA("sap.m.DatePicker")) {
                                        if(oCell.getBindingInfo("value").mandatory){
                                            if(oCell.getValue() === ""){
                                                oCell.setValueState(sap.ui.core.ValueState.Error);
                                                me._validationErrors.push(oCell.getId());
                                            }else{
                                                oCell.setValueState(sap.ui.core.ValueState.None);
                                                me._validationErrors.forEach((item, index) => {
                                                    if (item === oCell.getId()) {
                                                        me._validationErrors.splice(index, 1)
                                                    }
                                                })
                                            }
                                        }
                                    }
                                })
                            }
                        })
                    });
                }

                if(this._validationErrors.length > 0){
                    MessageBox.error("Please Fill Required Fields!");
                    bProceed = false;
                }
                
                if (bProceed) {
                    if (type === "UPDATE") {
                        oSelectedIndices.forEach(async (item, index) => {
                            oParamData = {
                                SALESDOCNO: aData.at(item).SALESDOCNO,
                                SALESDOCITEM: aData.at(item).SALESDOCITEM,
                                ITEMCAT: aData.at(item).ITEMCAT,
                                ITEMDESC: aData.at(item).ITEMDESC,
                                QTY: aData.at(item).QTY,
                                UOM: aData.at(item).UOM,
                                UNITPRICE: aData.at(item).UNITPRICE,
                                CPONO: aData.at(item).CPONO,
                                CPOREV: +aData.at(item).CPOREV,
                                CPOITEM: +aData.at(item).CPOITEM,
                                CPODT: aData.at(item).CPODT === "" ? null : sapDateFormat.format(new Date(aData.at(item).CPODT)) + "T00:00:00",
                                DLVDT: aData.at(item).DLVDT === "" ? null : sapDateFormat.format(new Date(aData.at(item).DLVDT)) + "T00:00:00",
                                CUSTSTYLE: aData.at(item).CUSTSTYLE,
                                CUSSTYLEDESC: aData.at(item).CUSTSTYLEDESC,
                                CUSTSHIPTO: aData.at(item).CUSTSHIPTO,
                                CUSTSHIPTOCD: aData.at(item).CUSTSHIPTOCD,
                                CUSTSHIPTONM: aData.at(item).CUSTSHIPTONM,
                                PRODUCTCD: aData.at(item).PRODUCTCD,
                                PRODUCTGRP: aData.at(item).PRODUCTGRP,
                                PRODUCTTYP: aData.at(item).PRODUCTTYP,
                                STYLETYP: aData.at(item).STYLETYP,
                                STYLEDESC: aData.at(item).STYLEDESC,
                                STYLENO: aData.at(item).STYLENO,
                                CUSTCOLOR: aData.at(item).CUSTCOLOR,
                                CUSTCOLDESC: aData.at(item).CUSTCOLDESC,
                                CUSTDEST: aData.at(item).CUSTDEST,
                                CUSTSIZE: aData.at(item).CUSTSIZE,
                                GENDER: aData.at(item).GENDER,
                                SALESCOLLECTION: aData.at(item).SALESCOLLECTION,
                                SHIPMODE: aData.at(item).SHIPMODE,
                                REFDOCNO: aData.at(item).REFDOCNO,
                                REMARKS: aData.at(item).REMARKS,
                                SAMPLEQTY: aData.at(item).SAMPLEQTY,
                                IONO: aData.at(item).IONO,
                                ITEMSTATUS: aData.at(item).ITEMSTATUS,
                                DELETED: aData.at(item).DELETED
                            }
                            // _promiseResult = new Promise((resolve, reject)=>{
                            //     oModel.create("/SALDOCDETSet(SALESDOCNO='"+ aData.at(item).SALESDOCNO +"',SALESDOCITEM="+ aData.at(item).SALESDOCITEM +")", oParamData, {
                            //         method: "PUT",
                            //         success: function(oData, oResponse){
                            //             resolve();
                            //         },error: function(error){
                            //             MessageBox.error(error);
                            //             resolve();
                            //         }
                            //     })
                            // });
                            // await _promiseResult;
                            oModel.update("/SDDETSet(SALESDOCNO='" + aData.at(item).SALESDOCNO + "',SALESDOCITEM=" + aData.at(item).SALESDOCITEM + ")", oParamData, updateModelParameter);
                        });

                        _promiseResult = new Promise((resolve, reject) => {
                            oModel.submitChanges({
                                groupId: "update",
                                success: function (oData, oResponse) {
                                    //Success
                                    resolve();
                                }, error: function (error) {
                                    MessageBox.error(error);
                                    resolve();
                                }
                            })
                        });
                        await _promiseResult;
                        this.byId("btnDetAdd").setVisible(true);
                        this.byId("btnDetEdit").setVisible(true);
                        this.byId("btnDetDelete").setVisible(true);
                        this.byId("btnDetSave").setVisible(false);
                        this.byId("btnDetCancel").setVisible(false);
                        this.byId("btnDetTabLayout").setVisible(true);
                        this.byId("TB1").setEnabled(true);

                        this._onBeforeDetailData = [];
                        await this.getDynamicTableColumns();


                        //Set Edit Mode
                        this.getView().getModel("ui").setProperty("/editMode", 'READ');
                    } else if (type === "NEW") {
                        oSelectedIndices.forEach(async (item, index) => {
                            oParamData = {
                                SALESDOCNO: me._salesDocNo,
                                // SALESDOCITEM    : aData.at(item).SALESDOCITEM,
                                ITEMCAT: aData.at(item).ITEMCAT,
                                ITEMDESC: aData.at(item).ITEMDESC,
                                QTY: aData.at(item).QTY,
                                UOM: aData.at(item).UOM,
                                UNITPRICE: aData.at(item).UNITPRICE,
                                CPONO: aData.at(item).CPONO,
                                CPOREV: +aData.at(item).CPOREV,
                                CPOITEM: +aData.at(item).CPOITEM,
                                CPODT: aData.at(item).CPODT === undefined ? null : sapDateFormat.format(new Date(aData.at(item).CPODT)) + "T00:00:00",
                                DLVDT: aData.at(item).DLVDT === undefined ? null : sapDateFormat.format(new Date(aData.at(item).DLVDT)) + "T00:00:00",
                                CUSTSTYLE: aData.at(item).CUSTSTYLE,
                                CUSTSTYLEDESC: aData.at(item).CUSTSTYLEDESC,
                                CUSTSHIPTO: aData.at(item).CUSTSHIPTO,
                                CUSTSHIPTOCD: aData.at(item).CUSTSHIPTOCD,
                                CUSTSHIPTONM: aData.at(item).CUSTSHIPTONM,
                                PRODUCTCD: aData.at(item).PRODUCTCD,
                                PRODUCTGRP: aData.at(item).PRODUCTGRP,
                                PRODUCTTYP: aData.at(item).PRODUCTTYP,
                                STYLETYP: aData.at(item).STYLETYP,
                                STYLEDESC: aData.at(item).STYLEDESC,
                                STYLENO: aData.at(item).STYLENO,
                                CUSTCOLOR: aData.at(item).CUSTCOLOR,
                                CUSTCOLDESC: aData.at(item).CUSTCOLDESC,
                                CUSTDEST: aData.at(item).CUSTDEST,
                                CUSTSIZE: aData.at(item).CUSTSIZE,
                                GENDER: aData.at(item).GENDER,
                                SALESCOLLECTION: aData.at(item).SALESCOLLECTION,
                                SHIPMODE: aData.at(item).SHIPMODE,
                                REFDOCNO: aData.at(item).REFDOCNO,
                                REMARKS: aData.at(item).REMARKS,
                                SAMPLEQTY: aData.at(item).SAMPLEQTY,
                                IONO: aData.at(item).IONO,
                                ITEMSTATUS: aData.at(item).ITEMSTATUS,
                                DELETED: aData.at(item).DELETED
                            }
                            // _promiseResult = new Promise((resolve, reject)=>{
                            //     oModel.create("/SALDOCDETSet(SALESDOCNO='"+ aData.at(item).SALESDOCNO +"',SALESDOCITEM="+ aData.at(item).SALESDOCITEM +")", oParamData, {
                            //         method: "PUT",
                            //         success: function(oData, oResponse){
                            //             resolve();
                            //         },error: function(error){
                            //             MessageBox.error(error);
                            //             resolve();
                            //         }
                            //     })
                            // });
                            // await _promiseResult;
                            oModel.create("/SALDOCDETSet", oParamData, insertModelParameter);
                        });

                        _promiseResult = new Promise((resolve, reject) => {
                            oModel.submitChanges({
                                success: function (oData, oResponse) {
                                    //Success
                                    resolve();
                                }, error: function (error) {
                                    MessageBox.error(error);
                                    resolve();
                                }
                            })
                        });
                        await _promiseResult;

                        this.byId("btnDetAdd").setVisible(true);
                        this.byId("btnDetEdit").setVisible(true);
                        this.byId("btnDetDelete").setVisible(true);
                        this.byId("btnDetDeleteEditRow").setVisible(false);
                        this.byId("btnDetSave").setVisible(false);
                        this.byId("btnDetCancel").setVisible(false);
                        this.byId("btnDetTabLayout").setVisible(true);
                        this.byId("TB1").setEnabled(true);

                        this._onBeforeDetailData = [];
                        await this.getDynamicTableColumns();

                        //Set Edit Mode
                        this.getView().getModel("ui").setProperty("/editMode", 'READ');
                    }
                }
                Common.closeLoadingDialog(that);
            },

            onSaveTableLayout: function () {
                var type = "SALDOCDET";
                var tabName = "ZERP_SALDOCDET";
                var vSBU = this._sbu;

                // saving of the layout of table
                var ctr = 1;
                var oTable = this.getView().byId("salDocDetDynTable");
                var oColumns = oTable.getColumns();

                var oParam = {
                    "SBU": vSBU,
                    "TYPE": type,
                    "TABNAME": tabName,
                    "TableLayoutToItems": []
                };

                //get information of columns, add to payload
                oColumns.forEach((column) => {
                    oParam.TableLayoutToItems.push({
                        COLUMNNAME: column.sId.split("-")[0],
                        ORDER: ctr.toString(),
                        SORTED: column.mProperties.sorted,
                        SORTORDER: column.mProperties.sortOrder,
                        SORTSEQ: "1",
                        VISIBLE: column.mProperties.visible,
                        WIDTH: column.mProperties.width.replace('rem', '')
                    });

                    ctr++;
                });

                //call the layout save
                var oModel = this.getOwnerComponent().getModel("ZGW_3DERP_COMMON_SRV");

                oModel.create("/TableLayoutSet", oParam, {
                    method: "POST",
                    success: function (data, oResponse) {
                        sap.m.MessageBox.information("Layout saved.");
                        //Common.showMessage(me._i18n.getText('t6'));
                    },
                    error: function (err) {
                        sap.m.MessageBox.error(err);
                    }
                });
            },

            onTableResize: function(oEvent){
                var vFullScreen = oEvent.getSource().data("Max") === "1" ? true : false;
                var vTableTyp = oEvent.getSource().data("Type");
                if(vTableTyp === "Dtl"){
                    if(vFullScreen){
                        this.byId("headerPanel").setVisible(false);
                        this.byId("btnDetBtnFullScreen").setVisible(false);
                        this.byId("btnDetBtnExitFullScreen").setVisible(true);
                    }else{
                        this.byId("headerPanel").setVisible(true);
                        this.byId("btnDetBtnFullScreen").setVisible(true);
                        this.byId("btnDetBtnExitFullScreen").setVisible(false);
                    }
                }
            },

            onSalDocDetDelete: async function () {
                var me = this;
                var salDocNo;
                var salDocItem

                var oModel = this.getOwnerComponent().getModel();
                oModel.setUseBatch(true);
                oModel.setDeferredGroups(["update"]);
                var insertModelParameter = {
                    "groupId": "insert"
                };
                var updateModelParameter = {
                    "groupId": "update"
                };

                var oTable = this.byId("salDocDetDynTable");
                var aSelIndices = oTable.getSelectedIndices();
                var oTmpSelectedIndices = [];
                var aData = oTable.getModel().getData().rows;
                var actionSel;

                var oParamData = []

                var bProceed = true;
                var iCounter = 0;
                if (await this.checkIfSalDocIsDeleted()) {
                    if (aSelIndices.length > 0) {
                        aSelIndices.forEach(item => {
                            oTmpSelectedIndices.push(oTable.getBinding("rows").aIndices[item])
                        })

                        aSelIndices = oTmpSelectedIndices;

                        aSelIndices.forEach(async (item, index) => {
                            if (aData.at(item).DELETED === true) {
                                iCounter++;
                                if (aSelIndices.length === iCounter) {
                                    bProceed = false;
                                    MessageBox.error("Sales Doc. Item Already Deleted");
                                }
                            }
                        })
                        if (bProceed) {
                            var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                            _promiseResult = new Promise((resolve, reject) => {
                                MessageBox.information(
                                    "Are you sure you want to delete selected items?",
                                    {
                                        actions: ["Yes", "No"],
                                        styleClass: bCompact ? "sapUiSizeCompact" : "",
                                        onClose: function (sAction) {
                                            actionSel = sAction;
                                            resolve(actionSel);
                                        }
                                    }
                                );
                            })
                            await _promiseResult;
                            if (actionSel === "Yes") {
                                if (bProceed) {
                                    //Set Edit Mode
                                    this.getView().getModel("ui").setProperty("/editMode", 'DELETE');

                                    aSelIndices.forEach(async (item, index) => {
                                        if (aData.at(item).DELETED === false) {
                                            salDocNo = aData.at(item).SALESDOCNO;
                                            salDocItem = aData.at(item).SALESDOCITEM;

                                            Common.openLoadingDialog(that);
                                            await oModel.read("/SALDOCDETSet", {
                                                urlParameters: {
                                                    "$filter": "SALESDOCNO eq '" + salDocNo + "'"
                                                },
                                                success: async function (oData, oResponse) {
                                                    oData.results.forEach(async item1 => {
                                                        item1.CPODT = dateFormat.format(new Date(item1.CPODT));
                                                        item1.DLVDT = dateFormat.format(new Date(item1.DLVDT));
                                                        item1.CREATEDTM = timeFormat.format(new Date(item1.CREATEDTM.ms + TZOffsetMs));
                                                        item1.UPDATEDTM = timeFormat.format(new Date(item1.UPDATEDTM.ms + TZOffsetMs));
                                                        item1.CREATEDDT = dateFormat.format(new Date(item1.CREATEDDT));
                                                        item1.UPDATEDDT = dateFormat.format(new Date(item1.UPDATEDDT));

                                                        if (salDocItem === item1.SALESDOCITEM) {
                                                            iCounter++;
                                                            oParamData = {
                                                                SALESDOCNO: aData.at(item).SALESDOCNO,
                                                                SALESDOCITEM: aData.at(item).SALESDOCITEM,
                                                                ITEMCAT: aData.at(item).ITEMCAT,
                                                                ITEMDESC: aData.at(item).ITEMDESC,
                                                                QTY: aData.at(item).QTY,
                                                                UOM: aData.at(item).UOM,
                                                                UNITPRICE: aData.at(item).UNITPRICE,
                                                                CPONO: aData.at(item).CPONO,
                                                                CPOREV: +aData.at(item).CPOREV,
                                                                CPOITEM: +aData.at(item).CPOITEM,
                                                                CPODT: aData.at(item).CPODT !== "" ? sapDateFormat.format(new Date(aData.at(item).CPODT)) + "T00:00:00" : null,
                                                                DLVDT: aData.at(item).DLVDT !== "" ? sapDateFormat.format(new Date(aData.at(item).DLVDT)) + "T00:00:00" : null,
                                                                CUSTSTYLE: aData.at(item).CUSTSTYLE,
                                                                CUSSTYLEDESC: aData.at(item).CUSSTYLEDESC,
                                                                CUSTSHIPTO: aData.at(item).CUSTSHIPTO,
                                                                PRODUCTCD: aData.at(item).PRODUCTCD,
                                                                PRODUCTGRP: aData.at(item).PRODUCTGRP,
                                                                PRODUCTTYP: aData.at(item).PRODUCTTYP,
                                                                STYLETYP: aData.at(item).STYLETYP,
                                                                STYLEDESC: aData.at(item).STYLEDESC,
                                                                STYLENO: aData.at(item).STYLENO,
                                                                CUSTCOLOR: aData.at(item).CUSTCOLOR,
                                                                CUSTDEST: aData.at(item).CUSTDEST,
                                                                CUSTSIZE: aData.at(item).CUSTSIZE,
                                                                GENDER: aData.at(item).GENDER,
                                                                SALESCOLLECTION: aData.at(item).SALESCOLLECTION,
                                                                SHIPMODE: aData.at(item).SHIPMODE,
                                                                REFDOCNO: aData.at(item).REFDOCNO,
                                                                REMARKS: aData.at(item).REMARKS,
                                                                SAMPLEQTY: aData.at(item).SAMPLEQTY,
                                                                IONO: aData.at(item).IONO,
                                                                ITEMSTATUS: aData.at(item).ITEMSTATUS,
                                                                DELETED: true
                                                            }
                                                            // _promiseResult = new Promise((resolve, reject)=>{
                                                            //     oModel.create("/SALDOCDETSet(SALESDOCNO='"+ aData.at(item).SALESDOCNO +"',SALESDOCITEM="+ aData.at(item).SALESDOCITEM +")", oParamData, {
                                                            //         method: "PUT",
                                                            //         success: function(oData, oResponse){
                                                            //             resolve();
                                                            //         },error: function(error){
                                                            //             MessageBox.error(error);
                                                            //             resolve();
                                                            //         }
                                                            //     })
                                                            // });
                                                            // await _promiseResult;
                                                            oModel.update("/SDDETSet(SALESDOCNO='" + aData.at(item).SALESDOCNO + "',SALESDOCITEM=" + aData.at(item).SALESDOCITEM + ")", oParamData, updateModelParameter);
                                                            if (aSelIndices.length === iCounter) {
                                                                _promiseResult = new Promise((resolve, reject) => {
                                                                    oModel.submitChanges({
                                                                        groupId: "update",
                                                                        success: function (oData, oResponse) {
                                                                            //Success
                                                                            resolve();
                                                                        }, error: function (error) {
                                                                            MessageBox.error(error);
                                                                            resolve();
                                                                        }
                                                                    })
                                                                });
                                                                await _promiseResult;
                                                                me._onBeforeDetailData = [];
                                                                await me.getDynamicTableColumns();
                                                            }
                                                        }
                                                    })
                                                },
                                                error: function (err) { }
                                            });

                                            Common.closeLoadingDialog(that);
                                        }

                                    });

                                    //Set Edit Mode
                                    this.getView().getModel("ui").setProperty("/editMode", 'READ');
                                }
                            } else if (actionSel === "Cancel") {
                                MessageBox.Action.CLOSE
                            }
                        }
                    } else {
                        MessageBox.error("No data to delete.");
                    }
                } else {
                    MessageBox.error("Sales Doc. is already Deleted!");
                }
            },

            onSalDocDetPurge: async function () {
                var me = this;

                var oModel = this.getOwnerComponent().getModel();
                var oTable = this.byId("salDocDetDynTable");
                var aSelIndices = oTable.getSelectedIndices();
                var oTmpSelectedIndices = [];
                var aData = this.getView().getModel("DetDataModel").getData().results;
                var actionSel;



                if (aSelIndices.length > 0) {
                    var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                    _promiseResult = new Promise((resolve, reject) => {
                        MessageBox.information(
                            "Are you sure you want to delete selected items?",
                            {
                                actions: ["Yes", "No"],
                                styleClass: bCompact ? "sapUiSizeCompact" : "",
                                onClose: function (sAction) {
                                    actionSel = sAction;
                                    resolve(actionSel);
                                }
                            }
                        );
                    })
                    await _promiseResult;

                    if (actionSel === "Yes") {
                        Common.openLoadingDialog(that);
                        this.getView().getModel("ui").setProperty("/editMode", 'DELETE');
                        aSelIndices.forEach(item => {
                            oTmpSelectedIndices.push(oTable.getBinding("rows").aIndices[item])
                        });

                        aSelIndices = oTmpSelectedIndices;
                        _promiseResult = new Promise((resolve, reject) => {
                            aSelIndices.forEach((item, index) => {
                                oModel.remove("/SALDOCDETSet(SALESDOCNO='" + aData.at(item).SALESDOCNO + "',SALESDOCITEM=" + aData.at(item).SALESDOCITEM + ")", {
                                    success: async function (oData, oResponse) {
                                        await me.getDynamicTableColumns();
                                        resolve();
                                    },
                                    error: function (err) {
                                        resolve();
                                    }
                                });
                            });
                        })
                        await _promiseResult;
                        this.getView().getModel("ui").setProperty("/editMode", 'READ');
                        Common.closeLoadingDialog(that);


                    } else if (actionSel === "Cancel") {
                        MessageBox.Action.CLOSE
                    }
                } else {
                    MessageBox.error("No data to delete.");
                }
            },

            onSalDocDetDeleteEditRow: async function(){
                var oTable;
                var aSelIndices;

                var oTmpSelectedIndices = [];
                var aDataRes = [];

                var aData;

                oTable = this.byId("salDocDetDynTable");
                aSelIndices = oTable.getSelectedIndices();
                oTmpSelectedIndices = [];
                aData = this.getView().getModel("DetDataModel").getData().results;

                if(aSelIndices.length > 0) {
                    aSelIndices.forEach(item => {
                        oTmpSelectedIndices.push(oTable.getBinding("rows").aIndices[item])
                    });
                    aSelIndices = oTmpSelectedIndices;

                    aSelIndices.forEach((item, index) => {
                        delete aData[item];
                    })

                    aData.forEach(item => {
                        aDataRes.push(item)
                    });

                    this._onBeforeDetailData = aDataRes;
                    this.getView().getModel("DetDataModel").setProperty("/results", aDataRes);
                    this.setTableData();

                    Common.openLoadingDialog(this);
                    await this.onRowEditSalDoc('salDocDetDynTable', 'DetDynColumns');
                    Common.closeLoadingDialog(this);
                }
            },

            onSalDocDetCancelEdit: async function () {
                var me = this;
                if (this._isEdited) {
                } else {
                    Common.openLoadingDialog(that);
                    this.byId("btnDetAdd").setVisible(true);
                    this.byId("btnDetEdit").setVisible(true);
                    this.byId("btnDetDelete").setVisible(true);
                    this.byId("btnDetDeleteEditRow").setVisible(false);
                    this.byId("btnDetSave").setVisible(false);
                    this.byId("btnDetCancel").setVisible(false);
                    // this.byId("btnDetCreateStyle").setVisible(true);
                    // this.byId("btnDetCreateIO").setVisible(true);
                    // this.byId("btnDetCreateStyleIO").setVisible(true);
                    this.byId("btnDetTabLayout").setVisible(true);
                    this.byId("TB1").setEnabled(true);
                    this._onBeforeDetailData = [];
                    await this.getDynamicTableColumns();
                    //Set Edit Mode
                    this.getView().getModel("ui").setProperty("/editMode", 'READ');
                    Common.closeLoadingDialog(that);
                }
            },

            disableOtherTabs: function (tabName) {
                var oIconTabBar = this.byId(tabName);
                oIconTabBar.getItems().filter(item => item.getProperty("key") !== oIconTabBar.getSelectedKey())
                    .forEach(item => item.setProperty("enabled", false));

            },
            disableOtherTabsChild: function (tabName) {
                var oIconTabBar = this.byId(tabName);
                oIconTabBar.getItems().filter(item => item.getProperty("key"))
                    .forEach(item => item.setProperty("enabled", false));

            },
            enableOtherTabs: function (tabName) {
                var oIconTabBar = this.byId(tabName);
                oIconTabBar.getItems().forEach(item => item.setProperty("enabled", true));
            },
            enableOtherTabsChild: function (tabName) {
                var oIconTabBar = this.byId(tabName);
                oIconTabBar.getItems().filter(item => item.getProperty("key"))
                    .forEach(item => item.setProperty("enabled", true));

            },

            //******************************************* */
            // Column Filtering
            //******************************************* */

            onColFilterClear: function(oEvent) {
                TableFilter.onColFilterClear(oEvent, this);
            },

            onColFilterCancel: function(oEvent) {
                TableFilter.onColFilterCancel(oEvent, this);
            },

            onColFilterConfirm: function(oEvent) {
                TableFilter.onColFilterConfirm(oEvent, this);
            },

            onFilterItemPress: function(oEvent) {
                TableFilter.onFilterItemPress(oEvent, this);
            },

            onFilterValuesSelectionChange: function(oEvent) {
                TableFilter.onFilterValuesSelectionChange(oEvent, this);
            },

            onSearchFilterValue: function(oEvent) {
                TableFilter.onSearchFilterValue(oEvent, this);
            },

            onCustomColFilterChange: function(oEvent) {
                TableFilter.onCustomColFilterChange(oEvent, this);
            },

            onSetUseColFilter: function(oEvent) {
                TableFilter.onSetUseColFilter(oEvent, this);
            },

            onRemoveColFilter: function(oEvent) {
                TableFilter.onRemoveColFilter(oEvent, this);
            },

            pad: Common.pad
        });
    });