sap.ui.define([
    "sap/ui/core/mvc/Controller",
    'sap/ui/model/Filter',
    "../js/Common",
    "../js/Utils",
    "sap/ui/model/json/JSONModel",
    'jquery.sap.global',
    'sap/m/MessageBox',
    'sap/ui/core/routing/HashChanger',
    'sap/m/MessageStrip',
    "../control/DynamicTable"
],
    /** 
     * @param {typeof sap.ui.core.mvc.Controller} Controller 
     */
    function (Controller, Filter, Common, Utils, JSONModel, jQuery, MessageBox, HashChanger, MessageStrip, control) {
        "use strict";

        var that;

        var Core = sap.ui.getCore();
        var _promiseResult;

        var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "MM/dd/yyyy" });
        var sapDateFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" });

        var timeFormat = sap.ui.core.format.DateFormat.getTimeInstance({ pattern: "KK:mm:ss a" });
        var TZOffsetMs = new Date(0).getTimezoneOffset() * 60 * 1000;

        return Controller.extend("zuisaldoc2.zuisaldoc2.controller.saldocdetail", {
            onInit: async function () {
                that = this;

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
                    DisplayMode: 'change'
                }), "ui");

                this.getAppAction();
            },

            getAppAction: async function () {
                // console.log("getAppAction");
                // console.log(sap.ushell.Container)
                var csAction = "display";
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

                DisplayStateModel.setData(DisplayData);
                this.getView().setModel(DisplayStateModel, "DisplayActionModel");
                // console.log(this.getView().getModel("DisplayActionModel"));
                // console.log(this.getView());

                // console.log(this.byId("btnHdrEdit"));
                // console.log(this.byId("btnHdrDelete"));

                // this.byId("btnHdrEdit").setVisible(csAction === "display" ? false : true);
                // this.byId("btnHdrDelete").setVisible(csAction === "display" ? false : true);
                this.byId("btnDetAdd").setVisible(csAction === "display" ? false : true);
                this.byId("btnDetEdit").setVisible(csAction === "display" ? false : true);
                this.byId("btnDetDelete").setVisible(csAction === "display" ? false : true);
            },

            _routePatternMatched: async function (oEvent) {
                Common.openLoadingDialog(that);               

                this._salesDocNo = oEvent.getParameter("arguments").salesdocno; //get Style from route pattern
                this._sbu = oEvent.getParameter("arguments").sbu; //get SBU from route pattern

                //set all as no changes at first load
                this._headerChanged = false;

                //set Change Status    
                this.setChangeStatus(false);

                //Load header
                await this.getHeaderConfig(); //get visible header fields

                if (this._salesDocNo === "NEW") {
                    //create new - only header is editable at first
                    this.getView().getModel("ui").setProperty("/Mode", 'NEW');
                    await this.setNewHeaderEditMode();
                    // this.setDetailVisible(false);
                } else {
                    //existing style, get the style data
                    this.getView().getModel("ui").setProperty("/Mode", 'UPDATE');
                    await this.getHeaderData(); //get header data
                    this.cancelHeaderEdit();
                    // this.setDetailVisible(true); //make detail section visible
                }

                // build Dynamic table for Sales Document Details
                await this.getDynamicTableColumns();

                this.byId("btnHdrEdit").setVisible(this.getView().getModel("ui").getProperty("/DisplayMode") === "display" ? false : true);
                this.byId("btnHdrDelete").setVisible(this.getView().getModel("ui").getProperty("/DisplayMode") === "display" ? false : true);

                Common.closeLoadingDialog(that);
            },
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
                                    item.Item = item.SEASON;
                                    item.Desc = item.DESCRIPTION;
                                })

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
                    await new Promise((resolve, reject) => {
                        oModelFilter.read('/ZVB_3D_CSHPTO_SH', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    item.Item = item.Kunnr;
                                })

                                valueHelpObjects = data.results;
                                title = "Sold-to Customer"
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                } else if (fieldName === 'CUSTBILLTO') {
                    await new Promise((resolve, reject) => {
                        oModelFilter.read('/ZVB_3D_CSHPTO_SH', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    item.Item = item.Kunnr;
                                })

                                valueHelpObjects = data.results;
                                title = "Bill-to Customer"
                                resolve();
                            },
                            error: function (err) {
                                resolve();
                            }
                        });
                    });
                } else if (fieldName === 'CURRENCYCD') {
                    await new Promise((resolve, reject) => {
                        oModelFilter.read('/ZVB_3DERP_CURRSH', {
                            success: function (data, response) {
                                data.results.forEach(item => {
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
                                item.CPODT = dateFormat.format(new Date(item.CPODT));
                                item.DLVDT = dateFormat.format(new Date(item.DLVDT));
                                item.CREATEDTM = timeFormat.format(new Date(item.CREATEDTM.ms + TZOffsetMs));
                                item.UPDATEDTM = timeFormat.format(new Date(item.UPDATEDTM.ms + TZOffsetMs));
                                item.CREATEDDT = dateFormat.format(new Date(item.CREATEDDT));
                                item.UPDATEDDT = dateFormat.format(new Date(item.UPDATEDDT));
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
                        template: me.columnTemplate(sColumnId, sColumnType, "Stat"),
                        width: me.getFormatColumnSize(sColumnId, sColumnType, sColumnWidth) + 'px',
                        sortProperty: sColumnId,
                        filterProperty: sColumnId,
                        autoResizable: true,
                        visible: sColumnVisible,
                        sorted: sColumnSorted,
                        sortOrder: ((sColumnSorted === true) ? sColumnSortOrder : "Ascending")
                    });
                });

                //bind the data to the table
                oDetTable.bindRows("/rows");
            },

            columnTemplate: function (sColumnId, sColumnType) {
                var oDetColumnTemplate;

                //different component based on field

                oDetColumnTemplate = new sap.m.Text({ text: "{" + sColumnId + "}", wrapping: false }); //default text

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
                            // oData.CREATEDDT = dateFormat.format(oData.CREATEDDT);
                            // oData.UPDATEDDT = dateFormat.format(oData.UPDATEDDT);
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

            setHeaderEditMode: async function () {
                //unlock editable fields of style header
                var oJSONModel = new JSONModel();
                this._headerChanged = false;

                var oDataEDitModel = this.getView().getModel("HeaderEditModeModel");
                var oDataEdit = oDataEDitModel.getProperty('/');
                var edditableFields = []
                if (await this.checkIfSalDocIsDeleted()) {
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

                    this.byId("btnHdrEdit").setVisible(false);
                    this.byId("btnHdrDelete").setVisible(false);
                    this.disableOtherTabs("itbDetail");

                    this.byId("btnHdrSave").setVisible(true);
                    this.byId("btnHdrCancel").setVisible(true);
                } else {
                    MessageBox.error("Sales Doc. is already Deleted!");
                }
            },

            setNewHeaderEditMode: async function () {
                //unlock editable fields of style header
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

            // setDetailVisible: function(bool) {
            //     var detailPanel = this.getView().byId('detailPanel'); //show detail section if there is header info
            //     detailPanel.setVisible(bool);
            // },
            onSaveHeader: async function () {
                var me = this;
                var oView = this.getView();
                var oDataEDitModel = this.getView().getModel("headerData");
                var oDataEdit = oDataEDitModel.getProperty('/');

                var oParamData = [];
                var bProceed = true;
                var bError = false;

                var oModel = this.getOwnerComponent().getModel();

                //Init Validation Errors Object
                this._validationErrors = [];

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

                            console.log(oDataEdit.DOCDT);
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
                                CPOREV: oDataEdit.CPOREV,
                                CPODT: sapDateFormat.format(new Date(oDataEdit.CPODT)) + "T00:00:00",
                                DLVDT: sapDateFormat.format(new Date(oDataEdit.DLVDT)) + "T00:00:00",
                                SEASONCD: oDataEdit.SEASONCD,
                                STATUS: "NEW",//oDataEdit.STATUS,
                                REMARKS: oDataEdit.REMARKS,
                                EDISOURCE: oDataEdit.EDISOURCE,
                                DELETED: oDataEdit.DELETED
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
                                CPOREV: oDataEdit.CPOREV,
                                CPODT: oDataEdit.CPODT !== undefined ? sapDateFormat.format(new Date(oDataEdit.CPODT)) + "T00:00:00" : null,
                                DLVDT: oDataEdit.DLVDT !== undefined ? sapDateFormat.format(new Date(oDataEdit.DLVDT)) + "T00:00:00" : null,
                                SEASONCD: oDataEdit.SEASONCD,
                                STATUS: "NEW",//oDataEdit.STATUS,
                                REMARKS: oDataEdit.REMARKS,
                                EDISOURCE: oDataEdit.EDISOURCE,
                                DELETED: oDataEdit.DELETED
                            }
                            _promiseResult = new Promise((resolve, reject) => {
                                oModel.setHeaders({
                                    SBU: me._sbu
                                });
                                oModel.create("/SALDOCHDRSet", oParamData, {
                                    method: "POST",
                                    success: async function (oData, oResponse) {
                                        me._salesDocNo = oData.SALESDOCNO;
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
                            this.enableOtherTabs("itbDetail");

                            this.byId("btnHdrSave").setVisible(false);
                            this.byId("btnHdrCancel").setVisible(false);
                            await this.closeHeaderEdit();
                        }

                        Common.closeLoadingDialog(that);
                    }
                }
            },

            cancelHeaderEdit: async function () {
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

                    await this.closeHeaderEdit();
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
                    var actionSel;
                    var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                    _promiseResult = new Promise((resolve, reject) => {
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
                    await _promiseResult;
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
                            CPOREV: oDataEdit.CPOREV,
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
                } else {
                    MessageBox.error("Sales Doc. is already Deleted!");
                }

            },

            onSalDocDetAdd: async function () {
                var me = this;
                var bProceed = true

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
                    await this.setTableData();
                    this.byId("btnDetAdd").setVisible(true);
                    this.byId("btnDetEdit").setVisible(false);
                    this.byId("btnDetDelete").setVisible(false);
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

                if (await this.checkIfSalDocIsDeleted()) {
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
                        .forEach(ci => {
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
                                        || sColumnName === "CUSTSIZE" || sColumnName === "PRODUCTCD" || sColumnName === "PRODUCTGRP") {
                                        col.setTemplate(new sap.m.Input({
                                            // id: "ipt" + ci.name,
                                            type: "Text",
                                            value: "{path: '" + ci.ColumnName + "', mandatory: '" + ci.Mandatory + "'}",
                                            maxLength: +ci.Length,
                                            showValueHelp: false,
                                            liveChange: this.onInputLiveChange.bind(this)
                                        }));
                                    } else {
                                        col.setTemplate(new sap.m.Input({
                                            // id: "ipt" + ci.name,
                                            type: "Text",
                                            value: "{path: '" + ci.ColumnName + "', mandatory: '" + ci.Mandatory + "'}",
                                            maxLength: +ci.Length,
                                            showValueHelp: true,
                                            valueHelpRequest: this.handleValueHelp.bind(this),
                                            liveChange: this.onInputLiveChange.bind(this)
                                        }));
                                    }
                                } else if (sColumnType === "DATETIME") {
                                    col.setTemplate(new sap.m.DatePicker({
                                        // id: "ipt" + ci.name,
                                        value: "{path: '" + ci.ColumnName + "', mandatory: '" + ci.Mandatory + "'}",
                                        displayFormat: "short",
                                        change: "handleChange",

                                        liveChange: this.onInputLiveChange.bind(this)
                                    }));
                                } else if (sColumnType === "NUMBER") {
                                    col.setTemplate(new sap.m.Input({
                                        // id: "ipt" + ci.name,
                                        type: sap.m.InputType.Number,
                                        value: "{path:'" + ci.ColumnName + "', mandatory: '" + ci.Mandatory + "', type:'sap.ui.model.type.Decimal', formatOptions:{ minFractionDigits:" + null + ", maxFractionDigits:" + null + " }, constraints:{ precision:" + ci.Decimal + ", scale:" + null + " }}",

                                        maxLength: +ci.Length,

                                        liveChange: this.onNumberLiveChange.bind(this)
                                    }));
                                }
                            }
                        });
                });
            },
            onHeaderChange: async function (oEvent) {
                var oModelFilter = this.getOwnerComponent().getModel('ZVB_3DERP_SALDOC_FILTERS_CDS');
                var resultData = "";

                if (oEvent.getSource().getId().includes("SALESTERM")) {
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
                if (oEvent.getParameters().value === oEvent.getSource().getBindingInfo("value").binding.oValue) {
                    this._isEdited = false;
                } else {
                    this._isEdited = true;
                }
            },

            onInputLiveChange: function (oEvent) {
                console.log(oEvent.getSource().getBindingInfo("value"));
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
                if (bProceed) {
                    if (type === "UPDATE") {
                        oSelectedIndices.forEach(item => {
                            oTmpSelectedIndices.push(oTable.getBinding("rows").aIndices[item])
                        })

                        oSelectedIndices = oTmpSelectedIndices;

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
                                CPODT: sapDateFormat.format(new Date(aData.at(item).CPODT)) + "T00:00:00",
                                DLVDT: sapDateFormat.format(new Date(aData.at(item).DLVDT)) + "T00:00:00",
                                CUSTSTYLE: aData.at(item).CUSTSTYLE,
                                CUSSTYLEDESC: aData.at(item).CUSTSTYLEDESC,
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

                        oSelectedIndices.forEach(item => {
                            oTmpSelectedIndices.push(oTable.getBinding("rows").aIndices[item])
                        })

                        oSelectedIndices = oTmpSelectedIndices;

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
                                                                CPOREV: aData.at(item).CPOREV,
                                                                CPOITEM: aData.at(item).CPOITEM,
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

            onSalDocDetCancelEdit: async function () {
                var me = this;
                if (this._isEdited) {
                } else {
                    Common.openLoadingDialog(that);
                    this.byId("btnDetAdd").setVisible(true);
                    this.byId("btnDetEdit").setVisible(true);
                    this.byId("btnDetDelete").setVisible(true);
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

            }
        });
    });