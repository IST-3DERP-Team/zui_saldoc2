sap.ui.define([
    "sap/ui/core/mvc/Controller",
    'sap/ui/model/Filter',
    "../js/Common",
    "../js/Utils",
    "sap/ui/model/json/JSONModel",
    'sap/m/MessageBox',
    "sap/ui/model/FilterOperator",
    "sap/ui/export/Spreadsheet",
    "../control/TableEvents",
    "sap/ui/core/routing/HashChanger",
    "../js/TableFilter",
    "../js/TableValueHelp",
    'sap/m/SearchField',
    'sap/ui/model/type/String',
    "sap/m/Token",
    // "../control/DynamicTable"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, Filter, Common, Utils, JSONModel, MessageBox, FilterOperator, Spreadsheet, control, HashChanger, TableFilter, TableValueHelp, SearchField, typeString, Token) {
        "use strict";

        var that;
        var _promiseResult;
        var sDisplayAction = "";
        
        var _captionList = [];

        var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "MM/dd/yyyy" });
        var timeFormat = sap.ui.core.format.DateFormat.getTimeInstance({ pattern: "KK:mm:ss a" });
        var TZOffsetMs = new Date(0).getTimezoneOffset() * 60 * 1000;

        return Controller.extend("zuisaldoc2.zuisaldoc2.controller.saldocinit", {
            onInit: async function (oEvent) {
                that = this;

                //get current userid
                var oModel = new sap.ui.model.json.JSONModel();

                //back button, check if has Locked
                //perform unLock function
                if (sap.ui.getCore().byId("backBtn") !== undefined) {
                    this._fBackButton = sap.ui.getCore().byId("backBtn").mEventRegistry.press[0].fFunction;

                    var oView = this.getView();
                    oView.addEventDelegate({
                        onAfterShow: async function (oEvent) {
                            sap.ui.getCore().byId("backBtn").mEventRegistry.press[0].fFunction = that._fBackButton;

                            // if (that.getOwnerComponent().getModel("UI_MODEL").getData().flag) {
                            //     that.refresh();
                            // }

                            if (that.getView().getModel("ui").getProperty("/LockType") === "S") {
                                that.unLock();
                            }
                            if(that._sbu !== "" && that._sbu !== null && that._sbu !== undefined){
                                Common.openLoadingDialog(that);
                                await that.getDynamicTableColumns('SALDOCINIT', 'ZDV_3DERP_SALDOC');
                                await that.getStatistics("/SalDocStatSet"); //style statistics
                                Common.closeLoadingDialog(that);
                            }
                        }
                    }, oView);
                }

                oModel.loadData("/sap/bc/ui2/start_up").then(() => {
                    this._userid = oModel.oData.id;
                })

                var oComponent = this.getOwnerComponent();
                this._router = oComponent.getRouter();
                // this._router.getRoute("RouteSalesDocHdr").attachPatternMatched(this._routePatternMatched, this);

                this.getView().setModel(new JSONModel({
                    crtStyleIOMode: '',
                    LockType: 'S',
                    LockMessage: '',
                    LockError: '',
                    DisplayMode: 'change',
                    saldocCount: 0,
                    activeSaldocNo: ''
                }), "ui");

                this.getAppAction();

                this.callCaptionsAPI();
                this.getView().setModel(new JSONModel(this.getOwnerComponent().getModel("CAPTION_MSGS_MODEL").getData().text), "ddtext");
                
                this._Model = this.getOwnerComponent().getModel();
                this.setSmartFilterModel();
                // this.onSearch();

                this.byId("_IDGenOverflowToolbars1").setEnabled(false);

                this._isEdited = false;
                this._validationErrors = [];
                this._tableFullScreenRender = false;

                this._aColumns = {};
                this._tableFilter = TableFilter;
                this._colFilters = {};

                this._tableValueHelp = TableValueHelp; 
                this._tblColumns = {}; 

                //OnRow Edit Increment Count
                this._tblOnRowEditincCount = 0;

                // if (this.getView().getModel("ui").getProperty("/DisplayAction") === "display") {
                //     var btnAdd = this.getView().byId("btnAddSalDoc");
                //     if (btnAdd.getVisible()) {
                //         btnAdd.setVisible(false);
                //     }

                //     var btnMenu = this.getView().byId("_IDGenMenuButton1");
                //     if (btnMenu.getVisible()) {
                //         btnMenu.setVisible(false);
                //     }
                // }
                this._oMultiInputSeasonCd = this.getView().byId("multiInputSEASONCD");
                this._oMultiInputSeasonCd.addValidator(this._onMultiInputValidate.bind(this));
            },

            onCustomSmartFilterValueHelp: function(oEvent){
                var oSource = oEvent.getSource();
                var sModel = oSource.mBindingInfos.suggestionRows.model;
                var oCustomSmartFilterModel;
                var oSmartField = {};

                if (sModel == "seasonCDSHSource") {
                    oSmartField = {
                        idLabel: "Season",
                        idName: "SEASONCD"
                    }

                    this.oColModel = new JSONModel({
                        "cols": [
                            {
                                "label": "Company",
                                "template": "SEASONCD",
                                "width": "10rem",
                                "sortProperty": "SEASONCD"
                            },
                            {
                                "label": "Description",
                                "template": "DESCRIPTION",
                                "sortProperty": "DESCRIPTION"
                            },
                        ]
                    });

                    oCustomSmartFilterModel = new JSONModel({
                        "title": "Season",
                        "key": "SEASONCD"
                    })
                }

                var aCols = this.oColModel.getData().cols;
                this._oBasicSearchField = new SearchField({
                    showSearchButton: false
                });

                this._oCustomSmartFilterValueHelpDialog = sap.ui.xmlfragment("zuisaldoc2.zuisaldoc2..view.fragments.valuehelp.SmartFilterValueHelpDialog", this);
                this.getView().addDependent(this._oCustomSmartFilterValueHelpDialog);

                this._oCustomSmartFilterValueHelpDialog.setModel(oCustomSmartFilterModel);

                this._oCustomSmartFilterValueHelpDialog.setRangeKeyFields([{
                    label: oSmartField.idLabel,
                    key: oSmartField.idName,
                    type: "string",
                    typeInstance: new typeString({}, {
                        maxLength: 4
                    })
                }]);

                this._oCustomSmartFilterValueHelpDialog.getTableAsync().then(function (oTable) {
                    oTable.setModel(this.getView().getModel(sModel));
                    oTable.setModel(this.oColModel, "columns");
                    if (oTable.bindRows) {
                        oTable.bindAggregation("rows", "/results");
                    }
    
                    if (oTable.bindItems) {
                        oTable.bindAggregation("items", "/results", function () {
                            return new ColumnListItem({
                                cells: aCols.map(function (column) {
                                    return new Label({ text: "{" + column.template + "}" });
                                })
                            });
                        });
                    }
    
                    this._oCustomSmartFilterValueHelpDialog.update();
                }.bind(this));

                if (sModel == "seasonCDSHSource") this._oCustomSmartFilterValueHelpDialog.setTokens(this._oMultiInputSeasonCd.getTokens());
                this._oCustomSmartFilterValueHelpDialog.open();
            },

            onCustomSmartFilterValueHelpOkPress: function (oEvent) {
                var me = this;
                var aTokens = oEvent.getParameter("tokens");
                var oSource = oEvent.getSource();
                var sKey = Object.values(oSource.oModels)[0].oData.key;

                aTokens.forEach(item => {
                    item.mProperties.text = item.mProperties.key;
                })

                if (sKey == "SEASONCD") {
                    this._oMultiInputSeasonCd.setTokens(aTokens);
                }
                this._oCustomSmartFilterValueHelpDialog.close();
            },

            onCustomSmartFilterValueHelpCancelPress: function () {
                this._oCustomSmartFilterValueHelpDialog.close();
            },
    
            onCustomSmartFilterValueHelpAfterClose: function () {
                this._oCustomSmartFilterValueHelpDialog.destroy();
            },

            onFilterBarSearch: function (oEvent) {
                var sSearchQuery = this._oBasicSearchField.getValue(),
                    aSelectionSet = oEvent.getParameter("selectionSet");
                
                var aFilters = aSelectionSet.reduce(function (aResult, oControl) {
    
                    var sKey = that._oCustomSmartFilterValueHelpDialog.getModel().oData.key;
                    if (oControl.getValue()) {
                        aResult.push(new Filter({
                            path: sKey, //oControl.getName(),
                            operator: FilterOperator.Contains,
                            value1: oControl.getValue()
                        }));
                    }
    
                    return aResult;
                }, []);
    
                this._filterTable(new Filter({
                    filters: aFilters,
                    and: true
                }));
            },
            _filterTable: function (oFilter) {
                var oValueHelpDialog = this._oCustomSmartFilterValueHelpDialog;
    
                oValueHelpDialog.getTableAsync().then(function (oTable) {
                    if (oTable.bindRows) {
                        oTable.getBinding("rows").filter(oFilter);
                    }
    
                    if (oTable.bindItems) {
                        oTable.getBinding("items").filter(oFilter);
                    }
    
                    oValueHelpDialog.update();
                });
            },

            _onMultiInputValidate: function(oArgs){
                var oSmartField = {};

                if (oArgs.suggestionObject.sId.includes("multiInputSEASONCD")) {
                    oSmartField.model = "seasonCDSHSource";
                    oSmartField.id = "SEASONCD";
                    oSmartField.desc = "DESCRIPTION";
                }

                var aToken;

                if (oSmartField.model == "seasonCDSHSource") aToken = this._oMultiInputSeasonCd.getTokens();

                if (oArgs.suggestionObject) {
                    var oObject = oArgs.suggestionObject.getBindingContext(oSmartField.model).getObject(),
                        oToken = new Token();

                    oToken.setKey(oObject[oSmartField.id]);
                    //oToken.setText(oObject[oSmartField.desc] + " (" + oObject[oSmartField.id] + ")");
                    oToken.setText(oObject[oSmartField.id]);
                    aToken.push(oToken)

                    if (oSmartField.model == "seasonCDSHSource") {
                        this._oMultiInputSeasonCd.setTokens(aToken);
                        this._oMultiInputSeasonCd.setValueState("None");
                    }
                }else if (oArgs.text !== "") {
                    if (oSmartField.model == "seasonCDSHSource") {
                        this._oMultiInputSeasonCd.setValueState("Error");
                    }
                }

                return null;
            },

            onCustomSmartFilterValueHelpChange: function(oEvent) {
                var me = this;
                var oSource = oEvent.getSource();
                if (oSource.sId.includes("multiInputSEASONCD")) {
                    if (oEvent.getParameter("value") === "") this._oMultiInputSeasonCd.setValueState("None");
                }
            },

            onCustomSmartFilterValueHelpTokenUpdate(oEvent) {
                var me = this;
                var oSource = oEvent.getSource();
                var oParameter = oEvent.getParameters();

                if (oParameter.type == "removed") {
                    if (oSource.sId.includes("multiInputSEASONCD")) {
                    }
                }
            },

            getAppAction: async function () {
                var csAction = "change";
                if (sap.ushell.Container !== undefined) {
                    const fullHash = new HashChanger().getHash();
                    const urlParsing = await sap.ushell.Container.getServiceAsync("URLParsing");
                    const shellHash = urlParsing.parseShellHash(fullHash);
                    csAction = shellHash.action;
                }

                var DisplayStateModel = new JSONModel();
                var DisplayData = {
                    sAction: csAction,
                    visible: csAction === "display" ? false : true
                }

                this.getView().getModel("ui").setProperty("/Displaymode", csAction);

                DisplayStateModel.setData(DisplayData);
                this.getView().setModel(DisplayStateModel, "DisplayActionModel");

                // alert(csAction);
                if (csAction === "display") {
                    var btnAdd = this.getView().byId("btnAddSalDoc");
                    if (btnAdd.getVisible()) {
                        btnAdd.setVisible(false);
                    }

                    var btnMenu = this.getView().byId("_IDGenMenuButton1");
                    if (btnMenu.getVisible()) {
                        btnMenu.setVisible(false);
                    }
                }
            },

            setSmartFilterModel: function () {
                //Model StyleHeaderFilters is for the smartfilterbar
                var oModel = this.getOwnerComponent().getModel("ZVB_3DERP_SALDOC_FILTERS_CDS");
                var oSmartFilter = this.getView().byId("SmartFilterBar");
                oSmartFilter.setModel(oModel);

                // oModel.read("/ZVB_3DERP_VENDOR_SH", {
                //     success: function (oData, oResponse) {
                //     },
                //     error: function (err) { 
                //     }
                // });
            },

            onRowChange: async function (oEvent) {
                var me = this;
                var sPath = oEvent.getParameter("rowContext");
                sPath = "/results/" + sPath.getPath().split("/")[2];
                var selPath = this.byId(oEvent.getParameters().id).mProperties.selectedIndex;

                var oTable = this.getView().byId("salDocDynTable");
                var model = oTable.getModel();

                var oRow = this.getView().getModel("DataModel").getProperty(sPath)

                
                this.getView().getModel("ui").setProperty("/activeSaldocNo", oRow.SALESDOCNO);

                _promiseResult = new Promise((resolve, reject) => {
                    oTable.getRows().forEach(row => {
                        if (row.getBindingContext().sPath.replace("/rows/", "") === sPath.split("/")[2]) {
                            resolve(row.addStyleClass("activeRow"));
                            // oTable.setSelectedIndex(selPath);
                        } else {
                            resolve(row.removeStyleClass("activeRow"));
                        }
                    });
                });

                //get the selected  data from the model and set to variable style
                // var data = model.getProperty(sPath);
                // salDocNotxt = data['SALESDOCNO'];

                // var oTable = this.getView().byId("salDocDynTable");
                // var aSelRows = oTable.getSelectedIndices();
                // if (aSelRows.length > 0) 
                // aSelRows.forEach(rec => {
                //     var oContext = oTable.getContextByIndex(rec);
                //     var vSALDOCNO = oContext.getObject().SALESDOCNO;
                //     salDocNotxt = vSALDOCNO;
                //     // var oEntitySet = "/GMCSet('" + vGmc + "')";
                //     // var oParam = {
                //     //     "Deleted": "X"
                //     });

                //     this.goToDetailClick(salDocNotxt);
            },
            onCellClick: async function (oEvent) {
                var sRowPath = oEvent.getParameters().rowBindingContext.sPath;
                sRowPath = "/results/" + sRowPath.split("/")[2];
                var oRow = this.getView().getModel("DataModel").getProperty(sRowPath)
                var oTable = this.getView().byId("salDocDynTable");

                this.getView().getModel("ui").setProperty("/activeSaldocNo", oRow.SALESDOCNO);

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
            onSaveTableLayout: function () {
                var type = "SALDOCINIT";
                var tabName = "ZDV_3DERP_SALDOC";
                var vSBU = this._sbu;

                // saving of the layout of table
                var ctr = 1;
                var oTable = this.getView().byId("salDocDynTable");
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
                        COLUMNNAME: column.sId.split("-")[1],
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
            // onDynamicSearch: async function(){
            //     var oJSONModel = new JSONModel();
            //     var extendPOData = {
            //         Title: "Create Purchase Order: Extension Option",
            //         Text: "PO of today's date already exists",
            //         POLabel: "Purchase Order",
            //         VendorLabel: "Vendor",
            //         PurchGrpLabel: "Purchasing Group",
            //         PONO: "resultPOExtend.at(0).PONO",
            //         VENDOR: "resultPOExtend.at(0).VENDOR",
            //         PURCHGRP: "resultPOExtend.at(0).PURCHGRP",
            //     }

            //     oJSONModel.setData(extendPOData);

            //     this.loadDynamicSearch = sap.ui.xmlfragment("zuisaldoc2.zuisaldoc2.view.fragments.dialog.DynamicSearchHelp", this);
            //     this.loadDynamicSearch.setModel(oJSONModel);
            //     this.getView().addDependent(this.loadDynamicSearch);
            //     this.loadDynamicSearch.open();
            // },

            setChangeStatus: function (changed) {
                //Set change flag 
                try {
                    sap.ushell.Container.setDirtyFlag(changed);
                } catch (err) { }
            },

            onSearch: async function () {
                Common.openLoadingDialog(this);
                // this._sbu = this.getView().byId("smartFilterBar").getFilterData().SBU;
                this._sbu = this.getView().byId("cboxSBU").getSelectedKey();

                this.getDynamicTableColumns('SALDOCINIT', 'ZDV_3DERP_SALDOC');
                this.getStatistics("/SalDocStatSet"); //style statistics
                this.byId("_IDGenOverflowToolbars1").setEnabled(true);
                await this.getSeasonCdSH();
                await this.onSuggestionItems();
                await this.getColumnProp();
                Common.closeLoadingDialog(this);


                // oTable.placeAt('scTable');
            },

            getSeasonCdSH: async function(){
                var me = this;
                var oJSONModel = new JSONModel();
                var iCounter = 0;
                var itemResult = [];
                var vSBU = this.getView().getModel("ui").getData().sbu;
                var oModel = this.getOwnerComponent().getModel("ZVB_3DERP_SALDOC_FILTERS_CDS");

                await new Promise((resolve, reject) => {
                    oModel.read("/ZVB_3DERP_SEASON_SH", {
                        success: function (oData, oResponse) {
                            for (var item in oData.results) {
                                iCounter++;
                                if (oData.results[item].SBU === vSBU) {
                                    itemResult.push(oData.results[item])
                                }
                                if (iCounter === oData.results.length) {
                                    oJSONModel.setData({results: itemResult})
                                    me.getView().setModel(oJSONModel, "seasonCDSHSource");
                                    resolve();
                                }
                            }
                        },
                        error: function (err) { }
                    });
                })
            },

            getDynamicTableColumns: async function (model, dataSource) {
                var me = this;

                //get dynamic columns based on saved layout or ZERP_CHECK
                var oJSONColumnsModel = new sap.ui.model.json.JSONModel();
                this.oJSONModel = new sap.ui.model.json.JSONModel();
                var oModel = this.getOwnerComponent().getModel("ZGW_3DERP_COMMON_SRV");

                var tableCol = [];

                // this._sbu = this.getView().byId("cboxSBU").getSelectedKey();

                oModel.setHeaders({
                    sbu: this._sbu,
                    type: model,
                    tabname: dataSource
                });

                //DynamicColumnsSet
                await new Promise(async (resolve, reject) => {
                    oModel.read("/ColumnsSet", {
                        success: async function (oData, oResponse) {
                            if (model === 'SALDOCINIT') {
                                me._aColumns["salDocDynTable"] = oData.results;
                                oJSONColumnsModel.setData(oData);
                                me.oJSONModel.setData(oData);
                                me.getView().setModel(oJSONColumnsModel, "DynColumns");  //set the view model
                                await me.getDynamicTableData(model);
                                resolve();
                            } else if (model === 'SALDOCCRTSTYLEIO') {
                                var tableColResults = {};

                                tableColResults['results'] = [{
                                    ColumnLabel: "Log Description",
                                    ColumnName: "LOGDESC",
                                    ColumnType: "STRING",
                                    ColumnWidth: 300,
                                    Creatable: false,
                                    DataType: "STRING",
                                    Decimal: 0,
                                    DictType: "CHAR",
                                    Editable: false,
                                    Key: "",
                                    Length: 150,
                                    Mandatory: true,
                                    Order: "001",
                                    Pivot: "",
                                    SortOrder: "",
                                    SortSeq: "",
                                    Sorted: false,
                                    Visible: false
                                }];
                                tableCol = tableColResults;

                                for (var index in oData.results) {
                                    tableCol.results.push(oData.results[index])
                                }
                                // tableCol = oData;
                                // tableCol.results.push({
                                //     ColumnLabel: "Log Description",
                                //     ColumnName: "LOGDESC",
                                //     ColumnType: "STRING",
                                //     ColumnWidth: 300,
                                //     Creatable: false,
                                //     DataType: "STRING",
                                //     Decimal: 0,
                                //     DictType: "CHAR",
                                //     Editable: false,
                                //     Key: "",
                                //     Length: 150,
                                //     Mandatory: true,
                                //     Order: "001",
                                //     Pivot: "",
                                //     SortOrder: "",
                                //     SortSeq: "",
                                //     Sorted: false,
                                //     Visible: false
                                // })
                                oJSONColumnsModel.setData(tableCol);
                                me.oJSONModel.setData(oData);
                                me.getView().setModel(oJSONColumnsModel, "SALDOCCRTSTYLEIOCOL");  //set the view model
                                // me.getDynamicTableData(model);
                                resolve();
                            }

                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                })
            },

            getDynamicTableData: async function (model) {
                var me = this;
                var oModel = this.getOwnerComponent().getModel();

                //get dynamic data
                var oJSONDataModel = new sap.ui.model.json.JSONModel();

                var oColumnsModel;
                var oData;
                var oDataModel;

                var oColumnsData;
                var oData;

                var aFilters = this.getView().byId("SmartFilterBar").getFilters();

                if (this.getView().byId("SmartFilterBar")) {
                    var oCtrl = this.getView().byId("SmartFilterBar").determineControlByName("SEASONCD");
    
                    if (oCtrl) {
                        var aCustomFilter = [];
    
                        if (oCtrl.getTokens().length === 1) {
                            oCtrl.getTokens().map(function(oToken) {
                                aFilters.push(new Filter("SEASONCD", FilterOperator.EQ, oToken.getKey()))
                            })
                        }
                        else if (oCtrl.getTokens().length > 1) {
                            oCtrl.getTokens().map(function(oToken) {
                                aCustomFilter.push(new Filter("SEASONCD", FilterOperator.EQ, oToken.getKey()))
                            })
    
                            aFilters.push(new Filter(aCustomFilter));
                        }
                    }
                }

                // aFiltersObj.push(aFilters);
                // aFiltersObj = aFiltersObj[0];

                // if (this.getView().byId("smartFilterBar")) {
                //     var oCtrlSeasonCd = this.getView().byId("smartFilterBar").determineControlByName("SEASONCD");
                //     if (oCtrlSeasonCd) {
                //         if (oCtrlSeasonCd.getSelectedKey() !== "") {
                //             if (aFilters.length === 0) {
                //                 aFiltersObj.push({
                //                     aFilters: [{
                //                         sPath: "SEASONCD",
                //                         sOperator: "EQ",
                //                         oValue1: oCtrlSeasonCd.getSelectedKey(),
                //                         _bMultiFilter: false
                //                     }]
                //                 })
                //             } else {
                //                 aFiltersObj[0].aFilters[parseInt(Object.keys(aFiltersObj[0].aFilters).pop()) + 1] = ({
                //                     sPath: "SEASONCD",
                //                     sOperator: "EQ",
                //                     oValue1: oCtrlSeasonCd.getSelectedKey(),
                //                     _bMultiFilter: false
                //                 })
                //             }
                //         }
                //     }
                // }

                // this.addDateFilters(aFilters); //date not automatically added to filters
                if (model === 'SALDOCINIT') {
                    await new Promise((resolve, reject)=>{
                        oModel.read("/SALDOCHDRINITSet", {
                            filters: aFilters,
                            success: function (oData, oResponse) {
                                // for(var x = 0; x < oData.results.length; x++){
                                //     var item = oData.results[x];
                                // }
                                oData.results.forEach(async item => {
                                    item.STATUS = item.STATUS === "New" ? "NEW" : item.STATUS;
                                    item.DLVDT = dateFormat.format(item.DLVDT);
                                    item.DOCDT = dateFormat.format(item.DOCDT);
                                    item.CPODT = dateFormat.format(item.CPODT);
                                    item.CREATEDTM = timeFormat.format(new Date(item.CREATEDTM.ms + TZOffsetMs));
                                    item.UPDATEDTM = timeFormat.format(new Date(item.UPDATEDTM.ms + TZOffsetMs));
                                    item.CREATEDDT = dateFormat.format(item.CREATEDDT);
                                    item.UPDATEDDT = dateFormat.format(item.UPDATEDDT);
                                    item.SALESORG = item.SALESORG + " - " + item.SALESORGDESC;
                                    item.CUSTGRP = item.CUSTGRP + " - " + item.CUSTGRPDESC;
                                    // if(item.SALESORG){
                                    //     var desc = await me.getDescTableColumn("SalesOrg", item.SALESORG);
                                    //     item.SALESORG = item.SALESORG + " - " + desc;
                                    // }
                                    // if(item.CUSTGRP){
                                    //     var desc = await me.getDescTableColumn("CustGrp", item.CUSTGRP);
                                    //     item.CUSTGRP = item.CUSTGRP + " - " + desc;
                                    // }
                                })

                                oData.results.sort((a, b) => (a.SALESDOCNO > b.SALESDOCNO ? -1 : 1));

                                // oText.setText(oData.results.length + "");
                                me.getView().getModel("ui").setProperty("/saldocCount", oData.results.length);
                                oJSONDataModel.setData(oData);
                                me.getView().setModel(oJSONDataModel, "DataModel");

                                var oColumnsModel = me.getView().getModel("DynColumns");
                                var oDataModel = me.getView().getModel("DataModel");

                                var oColumnsData = oColumnsModel.getProperty('/results');
                                var oData = oDataModel.getProperty('/results');

                                me.setTableData(oColumnsData, oData, 'salDocDynTable');
                                me.setChangeStatus(false);
                                TableFilter.applyColFilters("salDocDynTable", me);
                                resolve();
                            },
                            error: function (err) {
                                reject();
                            }
                        });
                        
                    })
                } else if (model === 'SALDOCCRTSTYLEIO') {
                    oColumnsModel = me.getView().getModel("SALDOCCRTSTYLEIOCOL");
                    oDataModel = me.getView().getModel("CrtStyleIOData").getData();

                    oColumnsData = oColumnsModel.getProperty('/results');
                    oData = oDataModel === undefined ? [] : oDataModel;

                    this.setTableData(oColumnsData, oData, 'createStyleIOTbl');
                    this.setChangeStatus(false);
                }
            },

            getDescTableColumn: async function(type, value){
                var me = this;
                var oModelFilter = this.getOwnerComponent().getModel('ZVB_3DERP_SALDOC_FILTERS_CDS');
                var result = "";
                
                if(type === "SalesOrg"){
                    await new Promise((resolve, reject) => {
                        oModelFilter.read('/ZVB_3DERP_SALESORG_SH', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    if(value === item.SALESORG){
                                        result = item.DESCRIPTION;
                                    }
                                })
                                resolve();
                            },
                            error: function (err) {
                                reject();
                            }
                        });
                    });
                }

                if(type === "CustGrp"){
                    await new Promise((resolve, reject) => {
                        oModelFilter.read('/ZVB_3DERP_CUSTGRP_SH', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    if(value === item.CUSTGRP){
                                        result = item.DESCRIPTION;
                                    }
                                })
                                resolve();
                            },
                            error: function (err) {
                                reject();
                            }
                        });
                    });
                }
                return result;
            },

            addDateFilters: function (aFilters) {
                //get the date filter of created date
                var createdDate = this.getView().byId("CreatedDatePicker").getValue();
                if (createdDate !== undefined && createdDate !== '') {
                    createdDate = createdDate.replace(/\s/g, '').toString(); //properly format the date for ABAP
                    var createDateStr = createdDate.split('–');
                    var createdDate1 = createDateStr[0];
                    var createdDate2 = createDateStr[1];
                    if (createdDate2 === undefined) {
                        createdDate2 = createdDate1;
                    }
                    var lv_createdDateFilter = new sap.ui.model.Filter({
                        path: "CREATEDDT",
                        operator: sap.ui.model.FilterOperator.BT,
                        value1: createdDate1,
                        value2: createdDate2
                    });

                    aFilters.push(lv_createdDateFilter);
                }

                //get the date filter of updated date
                var updatedDate = this.getView().byId("UpdatedDatePicker").getValue();
                if (updatedDate !== undefined && updatedDate !== '') {
                    updatedDate = updatedDate.replace(/\s/g, '').toString(); //properly format the date for ABAP
                    var createDateStr = updatedDate.split('–');
                    var updatedDate1 = createDateStr[0];
                    var updatedDate2 = createDateStr[1];
                    if (updatedDate2 === undefined) {
                        updatedDate2 = updatedDate1;
                    }
                    var lv_updatedDateFilter = new sap.ui.model.Filter({
                        path: "UPDATEDDT",
                        operator: sap.ui.model.FilterOperator.BT,
                        value1: updatedDate1,
                        value2: updatedDate2
                    });
                    aFilters.push(lv_updatedDateFilter); //add to the odata filter
                }
            },

            setTableData: function (oColumnsData, oData, table) {
                var me = this;

                var salDocNotxt = this.getView().getModel("ui").getData().activeSaldocNo;
                //set the column and data model
                var oModel = new JSONModel();
                oModel.setData({
                    columns: oColumnsData,
                    rows: oData
                });

                var oTable = this.getView().byId(table);
                oTable.setModel(oModel);

                if (table === 'salDocDynTable') {
                    var oDelegateKeyUp = {
                        onkeyup: function (oEvent) {
                            that.onKeyUp(oEvent);
                        },

                        onsapenter: function (oEvent) {
                            that.onSapEnter(oEvent);
                        }
                    };

                    this.byId(table).addEventDelegate(oDelegateKeyUp);



                    oTable.attachBrowserEvent('dblclick', function (e) {
                        e.preventDefault();
                        me.setChangeStatus(false); //remove change flag
                        me.navToDetail(me.getView().getModel("ui").getData().activeSaldocNo); //navigate to detail page

                    });
                }


                //bind the dynamic column to the table
                oTable.bindColumns("/columns", function (index, context) {
                    var sColumnId = context.getObject().ColumnName;
                    var sColumnLabel = context.getObject().ColumnLabel;
                    var sColumnType = context.getObject().ColumnType;
                    var sColumnWidth = context.getObject().ColumnWidth;
                    var sColumnVisible = context.getObject().Visible;
                    var sColumnSorted = context.getObject().Sorted;
                    var sColumnSortOrder = context.getObject().SortOrder;
                    // var sColumnToolTip = context.getObject().Tooltip;
                    //alert(sColumnId.);
                    // if (sColumnWidth === 0) sColumnWidth = me.getColumnSize(sColumnId, sColumnType)
                    return new sap.ui.table.Column({
                        id: table + '-' + sColumnId,
                        label: new sap.m.Text({text: sColumnLabel}), //"{i18n>" + sColumnId + "}",
                        template: me.columnTemplate(sColumnId, sColumnType),
                        width: sColumnWidth + 'px',//me.getFormatColumnSize(sColumnId, sColumnType, sColumnWidth) + 'px',
                        sortProperty: sColumnId,
                        filterProperty: sColumnId,
                        autoResizable: true,
                        visible: sColumnVisible,
                        sorted: sColumnSorted,
                        sortOrder: ((sColumnSorted === true) ? sColumnSortOrder : "Ascending")
                    });
                });

                //date/number sorting
                oTable.attachSort(function(oEvent) {
                    var sPath = oEvent.getParameter("column").getSortProperty();
                    var bDescending = false;
                    
                    //remove sort icon of currently sorted column
                    oTable.getColumns().forEach(col => {
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
                    var oColumn = oColumnsData.filter(fItem => fItem.ColumnName === oEvent.getParameter("column").getProperty("sortProperty"));
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
                    
                    oTable.getBinding('rows').sort(oSorter);
                    // prevent internal sorting by table
                    oEvent.preventDefault();
                });
                
                //bind the data to the table
                oTable.bindRows("/rows");
                TableFilter.updateColumnMenu(table, this);
            },

            columnTemplate: function (sColumnId, sColumnType) {
                var oColumnTemplate;

                //different component based on field
                if (sColumnId === "STATUS") { //display infolabel for Status Code
                    oColumnTemplate = new sap.tnt.InfoLabel({
                        text: "{" + sColumnId + "}",
                        colorScheme: "{= ${" + sColumnId + "} === 'New' ? 8 : ${" + sColumnId + "} === 'CRT' ? 3 : 3}"
                    })
                } else if (sColumnId === "STATUSCD") { //display infolabel for Status Code
                    oColumnTemplate = new sap.tnt.InfoLabel({
                        text: "{" + sColumnId + "}",
                        colorScheme: "{= ${" + sColumnId + "} === 'CMP' ? 8 : ${" + sColumnId + "} === 'CRT' ? 3 : 1}"
                    })
                } else if (sColumnType === "SEL") { //Manage button
                    oColumnTemplate = new sap.m.Button({
                        text: "",
                        icon: "sap-icon://detail-view",
                        type: "Ghost",
                        press: this.goToDetail,
                        tooltip: "Manage this Sales Doc",
                        visible: false
                        // ,
                        // visible: "false"
                    });
                    oColumnTemplate.data("SALESDOCNO", "{}"); //custom data to hold style number
                } else if (sColumnType === "COPY") { //Copy button
                    oColumnTemplate = new sap.m.Button({
                        text: "",
                        icon: "sap-icon://copy",
                        type: "Ghost",
                        press: this.onCopyStyle,
                        tooltip: "Copy this style"
                    });
                    oColumnTemplate.data("SALESDOCNO", "{}"); //custom data to hold style number
                } else {
                    oColumnTemplate = new sap.m.Text({ text: "{" + sColumnId + "}", wrapping: false }); //default text
                }

                return oColumnTemplate;
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

            onKeyUp: async function (oEvent) {
                if ((oEvent.key === "ArrowUp" || oEvent.key === "ArrowDown") && oEvent.srcControl.sParentAggregationName === "rows") {
                    var oTable = this.getView().byId("salDocDynTable");

                    var sRowPath = this.byId(oEvent.srcControl.sId).oBindingContexts["undefined"].sPath;
                    var index = sRowPath.split("/");
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

            onSapEnter(oEvent) {
                // var salesDocNo = oButton.data("SALESDOCNO").SALESDOCNO; //get the styleno binded to manage button
                var salDocNotxt = this.getView().getModel("ui").getData().activeSaldocNo;
                that.setChangeStatus(false); //remove change flag
                that.navToDetail(salDocNotxt, this._aSBU); //navigate to detail page
            },

            goToDetail: function (oEvent) {
                var oButton = oEvent.getSource();
                var salesDocNo = oButton.data("SALESDOCNO").SALESDOCNO; //get the styleno binded to manage button
                that.setChangeStatus(false); //remove change flag
                // alert(salesDocNo);
                that.navToDetail(salesDocNo); //navigate to detail page
            },
            addNewDetail: async function () {
                that.setChangeStatus(false); //remove change flag
                var salesDocNo = 'NEW'
                // alert(salesDocNo);
                that.navToDetail(salesDocNo); //navigate to detail page
            },

            goToDetailClick: function (salesdocno) {
                var salesDocNo = salesdocno;
                that.setChangeStatus(false); //remove change flag
                that.navToDetail(salesDocNo); //navigate to detail page
            },

            navToDetail: async function (salesDocNo, sbu) {
                console.log("Nav to Detail : " + salesDocNo);
                if (this.getView().getModel("ui").getProperty("/DisplayMode") === "change") {
                    if (salesDocNo !== "NEW")
                        await this.lock(this);
                }

                if (this.getView().getModel("ui").getProperty("/LockType") !== "E") {
                    this._router.navTo("RouteSalesDocDetail", {
                        salesdocno: salesDocNo,
                        sbu: this._sbu
                    });
                } else
                    MessageBox.error(this.getView().getModel("ui").getProperty("/LockMessage"));
            },

            onSearchSaldoc: function (oEvent) {
                var me = this;
                var oTable = this.byId("salDocDynTable");
                // var sTable = oTable.getBindingInfo("rows");
                var sQuery = oEvent.getParameter("query");
                var oFilter = null;
                var aFilter = [];

                if (sQuery && sQuery !== undefined) {
                    var oColumnsModel = me.getView().getModel("DynColumns");
                    var oColumnsData = oColumnsModel.getProperty('/results');
                    oTable.getColumns().forEach((col, idx) => {
                        var sDataType = oColumnsData.filter(item => item.ColumnName === col.sId.split("-")[1])[0].ColumnName

                        if (sDataType != "DELETED" && sDataType != "CLOSED")
                            aFilter.push(new Filter(sDataType, FilterOperator.Contains, sQuery));
                        else
                            aFilter.push(new Filter(sDataType, FilterOperator.EQ, sQuery));
                    })
                    oFilter = new Filter(aFilter, false);
                    
                }
                
                oTable.getBinding("rows").filter(oFilter, "Application");
                this.getView().getModel("ui").setProperty("/saldocCount", oTable.getBinding("rows").aIndices.length);
            },

            onSaldocCreateStyleIO: async function (type) {
                var me = this;

                this.getView().getModel("ui").setProperty("/crtStyleIOMode", '');

                var oModel = this.getOwnerComponent().getModel();
                var oTable = this.byId("salDocDynTable");
                var aSelIndices = oTable.getSelectedIndices();
                var oTmpSelectedIndices = [];
                var aData = this.getView().getModel("DataModel").getData().results;
                var aDataToEdit = [];
                var iCounter = 0;
                var bProceed = true;

                var crtIOListObj = [];
                var crtStyleListObj = [];

                var crtStyleIOObj = {};
                var crtStyleIOJSON = new JSONModel();

                var matchedDataObj = [];
                var oJSONModel = new JSONModel();

                var oColumnsModel;
                var oDataModel;
                var oColumnsData;
                var oData;

                await new Promise((resolve, reject) => {
                    oModel.read('/CRTIOLISTSet', {
                        success: function (data, response) {
                            data.results.forEach(element => {
                                if(element.CUSTSOLDTO !== undefined || element.CUSTSOLDTO !== "" || element.CUSTSOLDTO !== null)
                                    while (element.CUSTSOLDTO.length < 10) element.CUSTSOLDTO = "0" + element.CUSTSOLDTO;
                            });
                            crtIOListObj = data.results;
                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });

                await new Promise((resolve, reject) => {
                    oModel.read('/CRTSTYLISTSet', {
                        success: function (data, response) {
                            data.results.forEach(element => {
                                if(element.CUSTSOLDTO !== undefined || element.CUSTSOLDTO !== "" || element.CUSTSOLDTO !== null)
                                    while (element.CUSTSOLDTO.length < 10) element.CUSTSOLDTO = "0" + element.CUSTSOLDTO;
                            });
                            crtStyleListObj = data.results;
                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });

                if (aSelIndices.length > 0) {
                    this.onCreateStyleIO = sap.ui.xmlfragment(this.getView().getId(), "zuisaldoc2.zuisaldoc2.view.fragments.dialog.CreateStyleIO", this);
                    await new Promise((resolve, reject) => {
                        aSelIndices.forEach(item => {
                            oTmpSelectedIndices.push(oTable.getBinding("rows").aIndices[item])
                        });

                        aSelIndices = oTmpSelectedIndices;
                        aSelIndices.forEach(async (item, index) => {
                            if (type === "CrtStyle") {
                                iCounter++;
                                crtStyleIOObj = {
                                    Title: "Create Style",
                                    SaveButton: "Save Style"
                                };
                                crtStyleListObj.forEach(item2 => {
                                    if (item2.SALESDOCNO === aData.at(item).SALESDOCNO) {
                                        matchedDataObj.push(item2);
                                        resolve();
                                    }
                                });
                                if (aSelIndices.length === iCounter) {
                                    oJSONModel.setData(matchedDataObj);
                                    me.getView().setModel(oJSONModel, "CrtStyleIOData");
                                    await me.getDynamicTableColumns('SALDOCCRTSTYLEIO', 'ZDV_SDCRT_STY');

                                    oColumnsModel = me.getView().getModel("SALDOCCRTSTYLEIOCOL");
                                    oDataModel = me.getView().getModel("CrtStyleIOData").getData();

                                    oColumnsData = oColumnsModel.getProperty('/results');
                                    oData = oDataModel === undefined ? [] : oDataModel;

                                    me.getView().getModel("ui").setProperty("/crtStyleIOMode", 'CrtStyle');

                                    oColumnsData.forEach(item => {
                                        if (item.ColumnName === "IOTYPE" || item.ColumnName === "PRODSCEN" || item.ColumnName === "PLANMONTH") {
                                            item.Visible = false;
                                        }
                                        if (item.ColumnName === "FTYSTYLE" || item.ColumnName === "WEAVETYP" || item.ColumnName === "STYLECAT" || item.ColumnName === "SIZEGRP" || item.ColumnName === "PLANMONTH") {
                                            item.Length = 50;
                                        }
                                    })

                                    await me.setTableData(oColumnsData, oData, 'createStyleIOTbl');
                                    await me.onRowEditSalDoc('createStyleIOTbl', oColumnsData);
                                    me.setChangeStatus(false);
                                    resolve();
                                }
                                resolve();
                            } else if (type === "CrtIO") {
                                iCounter++;
                                crtStyleIOObj = {
                                    Title: "Create IO",
                                    SaveButton: "Save IO"
                                };
                                crtIOListObj.forEach(item2 => {
                                    if (item2.SALESDOCNO === aData.at(item).SALESDOCNO) {
                                        matchedDataObj.push(item2);
                                        resolve();
                                    }
                                });
                                if (aSelIndices.length === iCounter) {
                                    oJSONModel.setData(matchedDataObj);
                                    me.getView().setModel(oJSONModel, "CrtStyleIOData");
                                    await me.getDynamicTableColumns('SALDOCCRTSTYLEIO', 'ZDV_SDCRT_IO');

                                    oColumnsModel = me.getView().getModel("SALDOCCRTSTYLEIOCOL");
                                    oDataModel = me.getView().getModel("CrtStyleIOData").getData();

                                    oColumnsData = oColumnsModel.getProperty('/results');
                                    oData = oDataModel === undefined ? [] : oDataModel;

                                    me.getView().getModel("ui").setProperty("/crtStyleIOMode", 'CrtIO');

                                    oColumnsData.forEach(item => {
                                        if (item.ColumnName === "STYLECAT") {
                                            item.Visible = false;
                                        }
                                        if (item.ColumnName === "CUSTSOLDTO") {
                                            item.Visible = false;
                                        }
                                        if (item.ColumnName === "PLANMONTH") {
                                            item.Visible = false;
                                        }

                                        if (item.ColumnName === "PRODSCEN" || item.ColumnName === "IOTYPE") {//|| item.ColumnName === "PLANMONTH") {
                                            item.Editable = true;
                                            item.Length = 50;
                                        } else {
                                            item.Editable = false;
                                        }
                                    })

                                    await me.setTableData(oColumnsData, oData, 'createStyleIOTbl');
                                    await me.onRowEditSalDoc('createStyleIOTbl', oColumnsData);
                                    me.setChangeStatus(false);
                                    resolve();
                                }
                                resolve();
                            } else if (type === "CrtStyleIO") {
                                iCounter++;
                                crtStyleIOObj = {
                                    Title: "Create Style/IO",
                                    SaveButton: "Save Style/IO"
                                };
                                crtStyleListObj.forEach(item2 => {
                                    if (item2.SALESDOCNO === aData.at(item).SALESDOCNO) {
                                        matchedDataObj.push(item2);
                                        resolve();
                                    }
                                });
                                if (aSelIndices.length === iCounter) {
                                    oJSONModel.setData(matchedDataObj);
                                    me.getView().setModel(oJSONModel, "CrtStyleIOData");
                                    await me.getDynamicTableColumns('SALDOCCRTSTYLEIO', 'ZDV_SDCRT_STY');

                                    oColumnsModel = me.getView().getModel("SALDOCCRTSTYLEIOCOL");
                                    oDataModel = me.getView().getModel("CrtStyleIOData").getData();

                                    oColumnsData = oColumnsModel.getProperty('/results');
                                    oData = oDataModel === undefined ? [] : oDataModel;

                                    me.getView().getModel("ui").setProperty("/crtStyleIOMode", 'CrtStyleIO');

                                    oColumnsData.forEach(item => {
                                        if (item.ColumnName === "PRODSCEN" || item.ColumnName === "IOTYPE" || item.ColumnName === "PLANMONTH" ||
                                            item.ColumnName === "WEAVETYP" || item.ColumnName === "STYLECAT" || item.ColumnName === "SIZEGRP" ||
                                            item.ColumnName === "PLANMONTH" || item.ColumnName === "FTYSTYLE") {
                                            item.Length = 50;
                                        }
                                    })

                                    await me.setTableData(oColumnsData, oData, 'createStyleIOTbl');
                                    await me.onRowEditSalDoc('createStyleIOTbl', oColumnsData);
                                    me.setChangeStatus(false);
                                    resolve();
                                }
                                resolve();
                            }

                        })
                    })
                    this.getView().byId("vpoAddPRToPOSaveBtn").setVisible(true);
                    crtStyleIOJSON.setData(crtStyleIOObj);
                    this.onCreateStyleIO.setModel(crtStyleIOJSON);
                    this.getView().addDependent(this.onCreateStyleIO);



                    // oJSONModel.setData(oData);
                    // this.getView().setModel(oJSONModel, "VPOAddPRtoPO");

                    this.onCreateStyleIO.open();

                }

            },
            onSaveSaldocCreateStyleIO: async function () {
                var me = this;
                var vSBU = this._sbu;

                var oTable = this.byId("createStyleIOTbl");
                var oSelectedIndices = oTable.getBinding("rows").aIndices;
                var oTmpSelectedIndices = [];
                var aData = oTable.getModel().getData().rows;

                //Init Validation Errors Object
                this._validationErrors = [];
                //Boolean to check if there is Validation Errors
                var boolProceed = true;

                var aItems = oTable.getRows();

                var oModel = this.getOwnerComponent().getModel();

                var oParam = {};
                var oParamHdr = {};
                var oParamData = [];
                var oParamCrtIOStylSalDocItems = [];
                var sdProcessCd = "";
                var ioNo = "";
                var styleNo = "";
                var createdStyleIONo = []

                var createStyleResultStatus = ""
                var createStyleResultMsg = ""

                var seq = 0; //for Style and Style IO
                var saldocItem = "";

                var columnData = this.getView().getModel('SALDOCCRTSTYLEIOCOL').getData();
                var oDataModel = me.getView().getModel("CrtStyleIOData").getData();
                var oRowData = oDataModel === undefined ? [] : oDataModel;

                if (this.getView().getModel("ui").getData().crtStyleIOMode === "CrtStyle") {
                    sdProcessCd = "CRT_STY";
                } else if (this.getView().getModel("ui").getData().crtStyleIOMode === "CrtIO") {
                    sdProcessCd = "CRT_IO";
                } else if (this.getView().getModel("ui").getData().crtStyleIOMode === "CrtStyleIO") {
                    sdProcessCd = "CRT_STYIO";
                }

                oSelectedIndices.forEach(item => {
                    oTmpSelectedIndices.push(oTable.getBinding("rows").aIndices[item])
                })
                oSelectedIndices = oTmpSelectedIndices;

                if (oSelectedIndices.length > 0) {
                    aItems.forEach(function (oItem) {
                        oSelectedIndices.forEach((item, index) => {
                            if (oItem.getIndex() === item) {
                                var aCells = oItem.getCells();
                                aCells.forEach(function (oCell) {
                                    if (oCell.isA("sap.m.Input")) {
                                        if (oCell.getBindingInfo("value").mandatory === "true") {
                                            if (oCell.getValue() === "") {
                                                oCell.setValueState(sap.ui.core.ValueState.Error);
                                                me._validationErrors.push(oCell.getId());
                                            } else {
                                                oCell.setValueState(sap.ui.core.ValueState.None);
                                                me._validationErrors.forEach((item, index) => {
                                                    if (item === oCell.getId()) {
                                                        me._validationErrors.splice(index, 1)
                                                    }
                                                })
                                            }
                                        }
                                    } else if (oCell.isA("sap.m.DatePicker")) {
                                        if (oCell.getBindingInfo("value").mandatory === "true") {
                                            if (oCell.getValue() === "") {
                                                oCell.setValueState(sap.ui.core.ValueState.Error);
                                                me._validationErrors.push(oCell.getId());
                                            } else {
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

                if (this._validationErrors.length > 0) {
                    // MessageBox.error(this.getView().getModel("captionMsg").getData()["INFO_FILL_REQUIRED_FIELDS"]);
                    MessageBox.error("Please Fill Required Fields!");
                    boolProceed = false;
                }

                if (boolProceed) {
                    Common.openLoadingDialog(that);

                    oSelectedIndices.forEach((item, index) => {
                        if (aData.at(item).LOGDESCSTAT === "E" || aData.at(item).LOGDESCSTAT === "" || aData.at(item).LOGDESCSTAT === undefined) {
                            if (sdProcessCd === "CRT_STY") {
                                ioNo = "";
                                styleNo = "NEW";
                            } else if (sdProcessCd === "CRT_STYIO") {
                                ioNo = "NEW";
                                styleNo = "NEW";
                            } else if (sdProcessCd === "CRT_IO") {
                                ioNo = "NEW";
                                styleNo = "";
                            }
                            oParamHdr = {
                                SDPROCESS: sdProcessCd,
                                SBU: vSBU,
                            }
                            if(sdProcessCd === "CRT_STY" || sdProcessCd === "CRT_STYIO"){
                                seq++;
                                saldocItem = aData.at(item).SALESDOCITEM.split(',');

                                saldocItem.forEach((sdItem) => {
                                    oParamCrtIOStylSalDocItems.push({
                                        SEQ: seq.toString(),
                                        SALESDOCNO: aData.at(item).SALESDOCNO === undefined ? "" : aData.at(item).SALESDOCNO,
                                        SALESDOCITEM: sdItem
                                    })
                                });

                                oParamData.push({
                                    SEQ: seq.toString(),
                                    SALESDOCNO: aData.at(item).SALESDOCNO === undefined ? "" : aData.at(item).SALESDOCNO,
                                    STYLECD: aData.at(item).STYLECD === undefined ? "" : aData.at(item).STYLECD,
                                    STYLEDESC1: aData.at(item).STYLEDESC1 === undefined ? "" : aData.at(item).STYLEDESC1,
                                    SEASONCD: aData.at(item).SEASONCD === undefined ? "" : aData.at(item).SEASONCD,
                                    DESC1: aData.at(item).STYLEDESC1 === undefined ? "" : aData.at(item).STYLEDESC1,
                                    WVTYP: aData.at(item).WEAVETYP === undefined ? "" : aData.at(item).WEAVETYP,
                                    PRODTYP: aData.at(item).PRODUCTTYP === undefined ? "" : aData.at(item).PRODUCTTYP,
                                    SIZEGRP: aData.at(item).SIZEGRP === undefined ? "" : aData.at(item).SIZEGRP,
                                    SALESGRP: aData.at(item).SALESGRP === undefined ? "" : aData.at(item).SALESGRP,
                                    CUSTGRP: aData.at(item).CUSTGRP === undefined ? "" : aData.at(item).CUSTGRP,
                                    CUSTSOLDTO: aData.at(item).CUSTSOLDTO === undefined ? "" : aData.at(item).CUSTSOLDTO,
                                    UOM: aData.at(item).UOM === undefined ? "" : aData.at(item).UOM,
                                    STYLECAT: aData.at(item).STYLECAT === undefined ? "" : aData.at(item).STYLECAT,
                                    STYLENO: styleNo,
                                    VERNO: aData.at(item).VERNO === "" ? "1" : aData.at(item).VERNO,
                                    IONO: ioNo,
                                    IOTYPE: aData.at(item).IOTYPE === undefined ? "" : aData.at(item).IOTYPE,
                                    PRODSCEN: aData.at(item).PRODSCEN === undefined ? "" : aData.at(item).PRODSCEN,
                                    PLANMONTH: aData.at(item).PLANMONTH === undefined ? "" : aData.at(item).PLANMONTH
                                });
                                
                            }else{
                                oParamData.push({
                                    SALESDOCNO: aData.at(item).SALESDOCNO === undefined ? "" : aData.at(item).SALESDOCNO,
                                    STYLECD: aData.at(item).STYLECD === undefined ? "" : aData.at(item).STYLECD,
                                    STYLEDESC1: aData.at(item).STYLEDESC1 === undefined ? "" : aData.at(item).STYLEDESC1,
                                    SEASONCD: aData.at(item).SEASONCD === undefined ? "" : aData.at(item).SEASONCD,
                                    DESC1: aData.at(item).STYLEDESC1 === undefined ? "" : aData.at(item).STYLEDESC1,
                                    WVTYP: aData.at(item).WEAVETYP === undefined ? "" : aData.at(item).WEAVETYP,
                                    PRODTYP: aData.at(item).PRODUCTTYP === undefined ? "" : aData.at(item).PRODUCTTYP,
                                    SIZEGRP: aData.at(item).SIZEGRP === undefined ? "" : aData.at(item).SIZEGRP,
                                    SALESGRP: aData.at(item).SALESGRP === undefined ? "" : aData.at(item).SALESGRP,
                                    CUSTGRP: aData.at(item).CUSTGRP === undefined ? "" : aData.at(item).CUSTGRP,
                                    CUSTSOLDTO: aData.at(item).CUSTSOLDTO === undefined ? "" : aData.at(item).CUSTSOLDTO,
                                    UOM: aData.at(item).UOM === undefined ? "" : aData.at(item).UOM,
                                    STYLECAT: aData.at(item).STYLECAT === undefined ? "" : aData.at(item).STYLECAT,
                                    STYLENO: aData.at(item).STYLECAT === undefined ? "" : aData.at(item).STYLENO,
                                    VERNO: aData.at(item).VERNO === "" ? "1" : aData.at(item).VERNO,
                                    IONO: ioNo,
                                    IOTYPE: aData.at(item).IOTYPE === undefined ? "" : aData.at(item).IOTYPE,
                                    PRODSCEN: aData.at(item).PRODSCEN === undefined ? "" : aData.at(item).PRODSCEN,
                                    PLANMONTH: aData.at(item).PLANMONTH === undefined ? "" : aData.at(item).PLANMONTH
                                })
                            }
                        }
                    })
                    if (oParamData.length > 0) {
                        if(sdProcessCd === "CRT_STY" || sdProcessCd === "CRT_STYIO"){
                            oParam = oParamHdr;
                            oParam['CrtIOStylData'] = oParamData;
                            oParam['CrtIOStylSalDocItems'] = oParamCrtIOStylSalDocItems;
                            oParam['CrtIOStylRetMsg'] = [];

                        }else{
                            oParam = oParamHdr;
                            oParam['CrtIOStylData'] = oParamData;
                            oParam['CrtIOStylRetMsg'] = []
                        }

                        _promiseResult = new Promise((resolve, reject) => {
                            oModel.create("/CrtIOStylHdrSet", oParam, {
                                method: "POST",
                                success: async function (oData, oResponse) {

                                    for (var index in columnData.results) {
                                        if (columnData.results[index].ColumnName === "LOGDESC") {
                                            columnData.results[index].Visible = true;
                                        }
                                    }

                                    for (var index in oParam.CrtIOStylData) {
                                        for (var index2 in oData.CrtIOStylData.results) {
                                            if (oParam.CrtIOStylData[index].SALESDOCNO === oData.CrtIOStylData.results[index2].SALESDOCNO && oParam.CrtIOStylData[index].STYLECD === oData.CrtIOStylData.results[index2].STYLECD) {
                                                for (var index3 in oRowData) {
                                                    if (oRowData[index3].SALESDOCNO === oData.CrtIOStylData.results[index2].SALESDOCNO && oRowData[index3].STYLECD === oData.CrtIOStylData.results[index2].STYLECD) {
                                                        if (oData.CrtIOStylData.results[index2].MSGTYP === "E") {
                                                            if (oData.CrtIOStylData.results[index2].MSG !== "") {
                                                                oRowData[index3].LOGDESCSTAT = oData.CrtIOStylData.results[index2].MSGTYP
                                                                oRowData[index3].LOGDESC = oData.CrtIOStylData.results[index2].MSG
                                                                createStyleResultMsg = oData.CrtIOStylData.results[index2].MSG + " \n" + createStyleResultMsg;
                                                            } else {
                                                                oRowData[index3].LOGDESCSTAT = oData.CrtIOStylData.results[index2].MSGTYP
                                                                oRowData[index3].LOGDESC = "Error Encountered."
                                                            }
                                                        } else {
                                                            if (sdProcessCd === "CRT_STY") {
                                                                if (oData.CrtIOStylData.results[index2].MSG === "") {
                                                                    oRowData[index3].LOGDESCSTAT = "S"
                                                                    oRowData[index3].LOGDESC = "Style No. " + oData.CrtIOStylData.results[index2].STYLENO + " Successfully Created!";
                                                                    createStyleResultMsg = "Style No. " + oData.CrtIOStylData.results[index2].STYLENO + " Successfully Created!" + " \n" + createStyleResultMsg;
                                                                } else {
                                                                    oRowData[index3].LOGDESCSTAT = "S"
                                                                    oRowData[index3].LOGDESC = oData.CrtIOStylData.results[index2].MSG
                                                                    createStyleResultMsg = oData.CrtIOStylData.results[index2].MSG + " \n" + createStyleResultMsg;
                                                                }
                                                            } else if (sdProcessCd === "CRT_IO") {
                                                                if (oData.CrtIOStylData.results[index2].MSG === "") {
                                                                    oRowData[index3].LOGDESCSTAT = "S"
                                                                    oRowData[index3].LOGDESC = "IO No. " + oData.CrtIOStylData.results[index2].IONO + " Successfully Created!";
                                                                    createStyleResultMsg = "IO No. " + oData.CrtIOStylData.results[index2].IONO + " Successfully Created!" + " \n" + createStyleResultMsg;
                                                                } else {
                                                                    oRowData[index3].LOGDESCSTAT = "S"
                                                                    oRowData[index3].LOGDESC = oData.CrtIOStylData.results[index2].MSG
                                                                    createStyleResultMsg = oData.CrtIOStylData.results[index2].MSG + " \n" + createStyleResultMsg;
                                                                }
                                                            } else if (sdProcessCd === "CRT_STYIO") {
                                                                if (oData.CrtIOStylData.results[index2].MSG === "") {
                                                                    oRowData[index3].LOGDESCSTAT = "S"
                                                                    oRowData[index3].LOGDESC = "Style No. " + oData.CrtIOStylData.results[index2].STYLENO + " and IO No. " + oData.CrtIOStylData.results[index2].IONO + " Successfully Created!";
                                                                    createStyleResultMsg = "Style No. " + oData.CrtIOStylData.results[index2].STYLENO + " and IO No. " + oData.CrtIOStylData.results[index2].IONO + " Successfully Created!" + " \n" + createStyleResultMsg;
                                                                } else {
                                                                    oRowData[index3].LOGDESCSTAT = "S"
                                                                    oRowData[index3].LOGDESC = oData.CrtIOStylData.results[index2].MSG
                                                                    createStyleResultMsg = oData.CrtIOStylData.results[index2].MSG + " \n" + createStyleResultMsg;
                                                                }
                                                            }

                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    await me.setTableData(columnData.results, oRowData, 'createStyleIOTbl');
                                    await me.onRowEditSalDoc('createStyleIOTbl', columnData.results);
                                    me.getView().byId("vpoAddPRToPOSaveBtn").setVisible(false);
                                    me.setChangeStatus(false);

                                    if (oData.CrtIOStylData.results !== undefined) {
                                        oData.CrtIOStylData.results.forEach(iostyRes => {
                                            if (sdProcessCd === "CRT_STY" || sdProcessCd === "CRT_STYIO") {
                                                createdStyleIONo.push(iostyRes.STYLENO)

                                            } else if (sdProcessCd === "CRT_IO") {
                                                createdStyleIONo.push(iostyRes.IONO)
                                            }
                                        });
                                    }
                                    resolve();
                                }, error: function (error) {
                                    Common.closeLoadingDialog(that);
                                    MessageBox.error("Error Encountered in Process!");
                                    resolve();
                                }
                            })
                        })
                        await _promiseResult;
                        me.setChangeStatus(false);
                    } else {
                        MessageBox.information("No Data to Process!");
                    }


                    if (createStyleResultMsg.length > 0) {
                        MessageBox.information(createStyleResultMsg);
                    }
                    Common.closeLoadingDialog(that);
                }

            },
            onCancelSaldocCreateStyleIO: async function () {
                this.onCreateStyleIO.destroy(true);
            },

            onRowEditSalDoc: async function (table, model) {
                var me = this;
                var tblData = null;
                if (table === "createStyleIOTbl")
                    tblData = this.getView().byId("createStyleIOTbl").getBinding("rows").getModel().getData() === undefined ? null : this.getView().byId("createStyleIOTbl").getBinding("rows").getModel().getData().rows;

                // this.getView().getModel(model).getData().results.forEach(item => item.Edited = false);
                var oTable = this.byId(table);
                var oColumnsData = model;

                if (table === "createStyleIOTbl") {
                    oTable.getColumns().forEach((col, idx) => {
                        oColumnsData.filter(item => item.ColumnName === col.sId.split("-")[1])
                            .forEach(ci => {
                                me._tblOnRowEditincCount++;
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
                                        if (sColumnName === "STYLECD" || sColumnName === "STYLEDESC1") {
                                            col.setTemplate(new sap.m.Input({
                                                id: "col"+ me._tblOnRowEditincCount +"-" + sColumnName,
                                                type: "Text",
                                                value: "{path: '" + ci.ColumnName + "', mandatory: '" + ci.Mandatory + "'}",
                                                maxLength: +ci.Length,
                                                showValueHelp: false,
                                                liveChange: this.onInputLiveChange.bind(this)
                                            }));
                                        }else{
                                            
                                            col.setTemplate(new sap.m.Input({
                                                // // id: "ipt" + ci.name,
                                                // type: "Text",
                                                // value: "{path: '" + ci.ColumnName + "', mandatory: '" + ci.Mandatory + "'}",
                                                // enabled: {
                                                //     path: "SALESDOCNO",
                                                //     formatter: function (SALESDOCNO) {
                                                //         var result;
                                                //         tblData.forEach(async (data) => {
                                                //             if (data.LOGDESCSTAT === "S") {
                                                //                 result = false;
                                                //             }
                                                //         });
                                                //         return result;
                                                //     }

                                                // },
                                                // maxLength: +ci.Length,
                                                // showValueHelp: true,
                                                // valueHelpRequest: this.handleValueHelp.bind(this),
                                                // liveChange: this.onInputLiveChange.bind(this)
                                                id: "col"+ me._tblOnRowEditincCount +"-" + sColumnName,
                                                type: "Text",
                                                value: {
                                                    parts: [
                                                        { path: ci.ColumnName }, 
                                                        { value: "onSugg" + ci.ColumnName }, 
                                                        { value: 'Item' }, 
                                                        { value: 'Desc' }, 
                                                        { value: 'Other' }
                                                    ],
                                                    formatter: this.formatValueHelp.bind(this),
                                                    mandatory: ci.Mandatory
                                                },
                                                enabled: {
                                                    path: "SALESDOCNO",
                                                    formatter: function (SALESDOCNO) {
                                                        var result;
                                                        tblData.forEach(async (data) => {
                                                            if (data.LOGDESCSTAT === "S") {
                                                                result = false;
                                                            }
                                                        });
                                                        return result;
                                                    }

                                                },
                                                textFormatMode: 'Key',
                                                showValueHelp: true,
                                                valueHelpRequest: TableValueHelp.handleTableValueHelp.bind(this),//this.handleValueHelp.bind(this),
                                                showSuggestion: true,
                                                suggestionItems: {
                                                    path: 'onSugg' + ci.ColumnName + '>/',
                                                    length: 10000,
                                                    template: new sap.ui.core.ListItem({
                                                        key: '{onSugg' + ci.ColumnName + '>Item}',
                                                        text: '{onSugg' + ci.ColumnName + '>Desc}',
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
                                            id: "col"+ me._tblOnRowEditincCount +"-" + sColumnName,
                                            value: "{path: '" + ci.ColumnName + "', mandatory: '" + ci.Mandatory + "'}",
                                            enabled: {
                                                path: "SALESDOCNO",
                                                formatter: function (SALESDOCNO) {
                                                    var result;
                                                    tblData.forEach(async (data) => {
                                                        if (data.LOGDESCSTAT === "S") {
                                                            result = false;
                                                        }
                                                    });
                                                    return result;
                                                }

                                            },
                                            displayFormat: "short",
                                            change: "handleChange",

                                            liveChange: this.onInputLiveChange.bind(this)
                                        }));
                                    } else if (sColumnType === "NUMBER") {
                                        col.setTemplate(new sap.m.Input({
                                            id: "col"+ me._tblOnRowEditincCount +"-" + sColumnName,
                                            type: sap.m.InputType.Number,
                                            value: "{path:'" + ci.ColumnName + "', mandatory: '" + ci.Mandatory + "', type:'sap.ui.model.type.Decimal', formatOptions:{ minFractionDigits:" + null + ", maxFractionDigits:" + null + " }, constraints:{ precision:" + ci.Decimal + ", scale:" + null + " }}",

                                            maxLength: +ci.Length,

                                            liveChange: this.onNumberLiveChange.bind(this)
                                        }));
                                    }
                                    if (ci.Mandatory) {
                                        col.getLabel().addStyleClass("sapMLabelRequired");
                                        col.getLabel().addStyleClass("requiredField");
                                    }
                                }
                                if (ci.ColumnName === "LOGDESC") {
                                    col.getLabel().addStyleClass("sapMLabelRequired");
                                    col.getLabel().addStyleClass("requiredField");
                                }
                            });
                    });
                } else {
                    oTable.getColumns().forEach((col, idx) => {
                        oColumnsData.filter(item => item.ColumnName === col.sId.split("-")[1])
                            .forEach(ci => {
                                me._tblOnRowEditincCount++;
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
                                        col.setTemplate(new sap.m.Input({
                                            // // id: "ipt" + ci.name,
                                            // type: "Text",
                                            // value: "{path: '" + ci.ColumnName + "', mandatory: '" + ci.Mandatory + "'}",
                                            // maxLength: +ci.Length,
                                            // showValueHelp: true,
                                            // valueHelpRequest: this.handleValueHelp.bind(this),
                                            // liveChange: this.onInputLiveChange.bind(this)
                                            id: "col"+ me._tblOnRowEditincCount +"-" + sColumnName,
                                            type: "Text",
                                            value: {
                                                parts: [
                                                    { path: ci.ColumnName }, 
                                                    { value: "onSugg" + ci.ColumnName }, 
                                                    { value: 'Item' }, 
                                                    { value: 'Desc' }, 
                                                    { value: 'Other' }
                                                ],
                                                formatter: this.formatValueHelp.bind(this),
                                                mandatory: ci.Mandatory
                                            },
                                            textFormatMode: 'Key',
                                            showValueHelp: true,
                                            valueHelpRequest: TableValueHelp.handleTableValueHelp.bind(this),//this.handleValueHelp.bind(this),
                                            showSuggestion: true,
                                            suggestionItems: {
                                                path: 'onSugg' + ci.ColumnName + '>/',
                                                length: 10000,
                                                template: new sap.ui.core.ListItem({
                                                    key: '{onSugg' + ci.ColumnName + '>Item}',
                                                    text: '{onSugg' + ci.ColumnName + '>Desc}',
                                                    additionalText: '{onSugg' + ci.ColumnName + '>Item}'
                                                }),
                                                templateShareable: false
                                            },
                                            maxSuggestionWidth: "160px",
                                            change: this.onInputLiveChangeSuggestion.bind(this)
                                        }));
                                    } else if (sColumnType === "DATETIME") {
                                        col.setTemplate(new sap.m.DatePicker({
                                            id: "col"+ me._tblOnRowEditincCount +"-" + sColumnName,
                                            value: "{path: '" + ci.ColumnName + "', mandatory: '" + ci.Mandatory + "'}",
                                            displayFormat: "short",
                                            change: "handleChange",

                                            liveChange: this.onInputLiveChange.bind(this)
                                        }));
                                    } else if (sColumnType === "NUMBER") {
                                        col.setTemplate(new sap.m.Input({
                                            id: "col"+ me._tblOnRowEditincCount +"-" + sColumnName,
                                            type: sap.m.InputType.Number,
                                            value: "{path:'" + ci.ColumnName + "', mandatory: '" + ci.Mandatory + "', type:'sap.ui.model.type.Decimal', formatOptions:{ minFractionDigits:" + null + ", maxFractionDigits:" + null + " }, constraints:{ precision:" + ci.Decimal + ", scale:" + null + " }}",

                                            maxLength: +ci.Length,

                                            liveChange: this.onNumberLiveChange.bind(this)
                                        }));
                                    }
                                    if (ci.Mandatory) {
                                        col.getLabel().addStyleClass("sapMLabelRequired");
                                        col.getLabel().addStyleClass("requiredField");
                                    }
                                }
                                if (ci.ColumnName === "LOGDESC") {
                                    col.getLabel().addStyleClass("sapMLabelRequired");
                                    col.getLabel().addStyleClass("requiredField");
                                }
                            });
                    });
                }
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

            onInputLiveChangeSuggestion: async function(oEvent){
                var oSource = oEvent.getSource();
                var isInvalid = !oSource.getSelectedKey() && oSource.getValue().trim();
                oSource.setValueState(isInvalid ? "Error" : "None");
                oSource.setValueStateText("Invalid Entry");

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

                var fieldIsMandatory = oEvent.getSource().getBindingInfo("value").mandatory === undefined ? false : oEvent.getSource().getBindingInfo("value").mandatory;
                if (fieldIsMandatory) {
                    if (oEvent.getParameters().value === "") {
                        isInvalid = true;
                        oSource.setValueState(isInvalid ? "Error" : "None");
                        oEvent.getSource().setValueStateText("Required Field");
                    }
                }
                if (isInvalid) {
                    this._validationErrors.push(oEvent.getSource().getId());
                }else {
                    if(oEvent.getSource().getParent().getId().includes("createStyleIOTbl")){
                        var oInput = oEvent.getSource();
                        var oCell = oInput.getParent();
                        // var oRow = oCell.getBindingContext().getObject();
                        var sPath = oCell.getBindingContext().getPath();
                        var sRowPath = sPath == undefined ? null :"/"+ sPath.split("/")[2];
                        var sCol = oSource.getBindingInfo("value").parts[0].path;
                        this.getView().getModel("CrtStyleIOData").setProperty(sRowPath + "/" + sCol, oSource.getSelectedKey())
                    }else{
                        var sModel = oSource.getBindingInfo("value").parts[0].model;
                        var sPath = oSource.getBindingInfo("value").parts[0].path;
                        this.getView().getModel(sModel).setProperty(sPath, oSource.getSelectedKey());
                    }
                    

                    this._validationErrors.forEach((item, index) => {
                        if (item === oEvent.getSource().getId()) {
                            this._validationErrors.splice(index, 1)
                        }
                    })
                }
            },

            onInputLiveChange: function (oEvent) {
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

            onSalesDocReader: function () {
                var oModel = this.getOwnerComponent().getModel();
                var oForecast = this.getView().byId("forecastNumber");
                var oOrder = this.getView().byId("orderNumber");
                var oShipped = this.getView().byId("shippedNumber");

                var aFilters = this.getView().byId("SmartFilterBar").getFilters();

                this._Model.read("/SalDocStatsSet", {
                    filters: aFilters,
                    success: function (oData) {
                        oForecast.setNumber(oData.results[0].FORECAST);
                        oOrder.setNumber(oData.results[0].ORDER);
                        oShipped.setNumber(oData.results[0].SHIPPED);
                    },
                    error: function (err) { }
                });
            },

            getStatistics: function (EntitySet) {
                //select the style statistics
                var oForecast = this.getView().byId("forecastNumber");
                var oOrder = this.getView().byId("orderNumber");
                var oShipped = this.getView().byId("shippedNumber");

                var aFilters = this.getView().byId("SmartFilterBar").getFilters();
                // var lv_updatedDateFilter = new sap.ui.model.Filter({
                //     path: "SBU",
                //     operator: sap.ui.model.FilterOperator.EQ,
                //     value1: this._sbu
                // });
                // aFilters.push(lv_updatedDateFilter);

                var vEntitySet = EntitySet;

                this._Model.read(vEntitySet, {
                    filters: aFilters,
                    success: function (oData) {
                        oForecast.setNumber(oData.results[0].FORECASTQTY);
                        oOrder.setNumber(oData.results[0].ORDERQTY);
                        oShipped.setNumber(oData.results[0].SHIPQTY);
                    },
                    error: function (err) { }
                });
            },

            lock: async (me) => {
                console.log("Lock:");
                var oModelLock = me.getOwnerComponent().getModel("ZGW_3DERP_LOCK_SRV");
                var oParamLock = {};
                var oSALDOC_TAB = [];
                var sError = "";
                var salDocNotxt = me.getView().getModel("ui").getData().activeSaldocNo;

                oSALDOC_TAB.push({
                    "Salesdocno": salDocNotxt,
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

            unLock() {
                var oModelLock = this.getOwnerComponent().getModel("ZGW_3DERP_LOCK_SRV");
                var oParamUnLock = {};
                var oSALDOC_TAB = [];
                var me = this;
                var sError = "";
                var salDocNotxt = this.getView().getModel("ui").getData().activeSaldocNo;

                oSALDOC_TAB.push({
                    "Salesdocno": salDocNotxt,
                    "Lock": ""
                })

                oParamUnLock["SALDOC_TAB"] = oSALDOC_TAB;
                oParamUnLock["Iv_Count"] = 300;
                oParamUnLock["SALDOC_MSG"] = [];

                console.log(oParamUnLock);

                oModelLock.create("/ZERP_SALDOCHDR", oParamUnLock, {
                    method: "POST",
                    success: function (oResultLock) {
                        oResultLock.SALDOC_MSG.results.forEach(item => {
                            if (item.Type === "S") {
                                me.getView().getModel("ui").setProperty("/LockType", "");
                                me.getView().getModel("ui").setProperty("/LockMessage", item.Message);
                                // alert(me.getView().getModel("ui").getProperty("/isLocked"));
                            }
                            sError += item.Message + ".\r\n ";
                        })

                        console.log("Unlock", oResultLock)
                    },
                    error: function (err) {
                        // me.closeLoadingDialog();
                    }
                })

                this._oLock = [];
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

                    var custGrp = this.getView().byId("CUSTGRP").getValue();
                    if (custGrp === "" || custGrp === null || custGrp === undefined) {
                        this.getView().byId("CUSTGRP").setValueState("Error");
                        this.getView().byId("CUSTGRP").setValueStateText("Required Field!");
                        MessageBox.error("Please Select Customer Group First!");
                        return;
                    } else {
                        await new Promise((resolve, reject) => {
                            oModel3DERP.setHeaders({
                                sbu: this._sbu
                            });
                            oModel3DERP.read('/SoldToCustSet', {
                                success: function (data, response) {
                                    var dataResult = [];
                                    data.results.forEach(item => {
                                        if (custGrp === item.Custgrp) {
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
                    await new Promise((resolve, reject) => {
                        oModelFilter.read('/ZVB_3D_CBLLTO_SH', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    while (item.Kunnr.length < 10) item.Kunnr = "0" + item.Kunnr;
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
                } else if (fieldName === 'CUSTSHIPTO') {
                    await new Promise((resolve, reject) => {
                        oModel.read('/SHIPTOvhSet', {
                            success: function (data, response) {
                                data.results.forEach(item => {
                                    item.Item = item.KUNNR;
                                    item.Desc = item.DESC1;
                                })

                                valueHelpObjects = data.results;
                                title = "Ship-To Customer"
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

                //SEASONCD
                await new Promise((resolve, reject) => {
                    oModelFilter.read('/ZVB_3DERP_SEASON_SH', {
                        success: function (data, response) {
                            data.results.forEach(item => {
                                item.Item = item.SEASONCD;
                                item.Desc = item.DESCRIPTION;
                            })

                            me.getView().setModel(new JSONModel(data.results),"onSuggSEASONCD");
                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });
                //WEAVETYP
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
                            me.getView().setModel(new JSONModel(data.results),"onSuggWEAVETYP");
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
                //STYLECAT
                await new Promise((resolve, reject) => {
                    oModel3DERP.setHeaders({
                        sbu: vSBU
                    });
                    oModel3DERP.read('/StyleCatSet', {
                        success: function (data, response) {
                            data.results.forEach(item => {
                                item.Item = item.Stylcat;
                                item.Desc = item.Desc1;
                            });
                            me.getView().setModel(new JSONModel(data.results),"onSuggSTYLECAT");
                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });
                //SIZEGRP
                await new Promise((resolve, reject) => {
                    oModel3DERP.read('/SizeGrpSet', {
                        success: function (data, response) {
                            data.results.forEach(item => {
                                item.Item = item.AttribGrp;
                                // item.Desc = item.Desc1;
                            })

                            me.getView().setModel(new JSONModel(data.results),"onSuggSIZEGRP");
                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });
                //SALESGRP
                await new Promise((resolve, reject) => {
                    oModelFilter.read('/ZVB_3DERP_SALESGRP_SH', {
                        success: function (data, response) {
                            data.results.forEach(item => {
                                item.Item = item.SALESGRP;
                                item.Desc = item.DESCRIPTION;
                            })

                            me.getView().setModel(new JSONModel(data.results),"onSuggSALESGRP");
                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });
                //CUSTSOLDTO
                // var custGrp = this.getView().byId("CUSTGRP").getValue();
                // if (custGrp === "" || custGrp === null || custGrp === undefined) {
                //     this.getView().byId("CUSTGRP").setValueState("Error");
                //     this.getView().byId("CUSTGRP").setValueStateText("Required Field!");
                //     MessageBox.error("Please Select Customer Group First!");
                //     return;
                // } else {
                //     await new Promise((resolve, reject) => {
                //         oModel3DERP.setHeaders({
                //             sbu: this._sbu
                //         });
                //         oModel3DERP.read('/SoldToCustSet', {
                //             success: function (data, response) {
                //                 var dataResult = [];
                //                 data.results.forEach(item => {
                //                     if (custGrp === item.Custgrp) {
                //                         item.Item = item.Custno;
                //                         item.Desc = item.Desc1;
                //                         dataResult.push(item)
                //                     }
                //                 })

                //                 valueHelpObjects = dataResult;
                //                 title = "Sold-to Customer"
                //                 resolve();
                //             },
                //             error: function (err) {
                //                 resolve();
                //             }
                //         });
                //     });

                // }
                //CUSTGRP
                await new Promise((resolve, reject) => {
                    oModelFilter.read('/ZVB_3DERP_CUSTGRP_SH', {
                        success: function (data, response) {
                            data.results.forEach(item => {
                                item.Item = item.CUSTGRP;
                                item.Desc = item.DESCRIPTION;
                            })

                            me.getView().setModel(new JSONModel(data.results),"onSuggCUSTGRP");
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
                //IOTYPE
                await new Promise((resolve, reject) => {
                    oModel.read('/IOTYPvhSet', {
                        success: function (data, response) {
                            data.results.forEach(item => {
                                item.Item = item.IOTYPE;
                                item.Desc = item.DESC1;
                            })

                            me.getView().setModel(new JSONModel(data.results),"onSuggIOTYPE");
                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });
                //PRODSCEN
                await new Promise((resolve, reject) => {
                    oModel.read('/PRODSCENvhSet', {
                        success: function (data, response) {
                            data.results.forEach(item => {
                                item.Item = item.PRODSCEN;
                                item.Desc = item.DESC1;
                            })

                            me.getView().setModel(new JSONModel(data.results),"onSuggPRODSCEN");
                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });

            },

            onSuggCustSoldTo: async function(oEvent){
                var me = this;
                var oModel3DERP = this.getOwnerComponent().getModel('ZGW_3DERP_SH_SRV');
                var oSource = oEvent.getSource();
                var sRowPath = oSource.oParent.getBindingContext().sPath;
                var vFieldVal = oEvent.getSource().oParent.oParent.getModel().getProperty(sRowPath + "/CUSTGRP");

                await new Promise((resolve, reject) => {
                    oModel3DERP.setHeaders({
                        sbu: this._sbu
                    });
                    oModel3DERP.read('/SoldToCustSet', {
                        success: function (data, response) {
                            var dataResult = [];
                            data.results.forEach(item => {
                                if (vFieldVal === item.Custgrp) {
                                    item.Item = item.Custno;
                                    item.Desc = item.Desc1;
                                    dataResult.push(item)
                                }
                            })
                            me.getView().setModel(new JSONModel(dataResult),"onSuggCUSTSOLDTO");
                            resolve();
                        },
                        error: function (err) {
                            resolve();
                        }
                    });
                });
            },

            onTableResize: function(oEvent){
                var event = oEvent.getSource();
                var me = this;

                var vFullScreen = oEvent.getSource().data("Max") === "1" ? true : false;
                if(!this._tableFullScreenRender){
                    this.byId("SmartFilterBar").setFilterBarExpanded(!vFullScreen);
                    this._tableFullScreenRender = true;
                }else{
                    this.byId("SmartFilterBar").setFilterBarExpanded(vFullScreen);
                    this._tableFullScreenRender = false;
                }
            },

            // onFilter: async function(oEvent){
            //     var oTable = oEvent.getSource();

            //     this.setActiveRowHighlight(oTable);
            // },

            setActiveRowHighlight(arg) {
                var oTable = this.byId(arg);
                
                setTimeout(() => {
                    if (oTable.getModel(arg) !== undefined) {
                        var iActiveRowIndex = oTable.getModel(arg).getData().results.findIndex(item => item.ACTIVE === "X");

                        oTable.getRows().forEach(row => {
                            if (row.getBindingContext(arg) && +row.getBindingContext(arg).sPath.replace("/", "") === iActiveRowIndex) {
                                row.addStyleClass("activeRow");
                            }
                            else row.removeStyleClass("activeRow");
                        })
                    }
                }, 1);
            },

            callCaptionsAPI: function(){
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

                oDDTextParam.push({CODE: "FULLSCREEN"});
                oDDTextParam.push({CODE: "EXITFULLSCREEN"});
                

                oModel.create("/CaptionMsgSet", { CaptionMsgItems: oDDTextParam  }, {
                    method: "POST",
                    success: function(oData, oResponse) {
                        oData.CaptionMsgItems.results.forEach(item=>{
                            oDDTextResult[item.CODE] = item.TEXT;
                        })
                        _captionList = oDDTextResult;
                        oJSONModel.setData(oDDTextResult);
                        me.getView().setModel(oJSONModel, "captionMsg");
                        me.getOwnerComponent().getModel("CAPTION_MSGS_MODEL").setData({text: oDDTextResult})
                    },
                    error: function(err) {
                        sap.m.MessageBox.error(_captionList.INFO_ERROR);
                    }
                });
            },

            onColumnUpdated: function(oEvent){
                var oTable = oEvent.getSource();
                var sTabId = oTable.sId.split("--")[oTable.sId.split("--").length - 1];

                
                // console.log(sTabId)
                // this._sActiveTable = sTabId;

                // this.setActiveRowHighlightByTableId(sTabId);
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
