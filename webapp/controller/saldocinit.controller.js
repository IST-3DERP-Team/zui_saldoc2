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
    "sap/ui/core/routing/HashChanger"
    // "../control/DynamicTable"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, Filter, Common, Utils, JSONModel, MessageBox, FilterOperator, Spreadsheet, control, HashChanger) {
        "use strict";

        var that;
        var salDocNotxt;
        var _promiseResult;
        var sDisplayAction = "";

        var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "MM/dd/yyyy" });
        var timeFormat = sap.ui.core.format.DateFormat.getTimeInstance({ pattern: "KK:mm:ss a" });
        var TZOffsetMs = new Date(0).getTimezoneOffset() * 60 * 1000;

        return Controller.extend("zuisaldoc2.zuisaldoc2.controller.saldocinit", {
            onInit: function (oEvent) {
                that = this;

                //get current userid
                var oModel = new sap.ui.model.json.JSONModel();
                oModel.loadData("/sap/bc/ui2/start_up").then(() => {
                    this._userid = oModel.oData.id;
                })

                var oComponent = this.getOwnerComponent();
                this._router = oComponent.getRouter();
                // this._router.getRoute("RouteSalesDocHdr").attachPatternMatched(this._routePatternMatched, this);

                this.getView().setModel(new JSONModel({
                    crtStyleIOMode: ''
                }), "ui");

                this.getAppAction();

                this._Model = this.getOwnerComponent().getModel();
                this.setSmartFilterModel();
                // this.onSearch();

                this.byId("_IDGenOverflowToolbars1").setEnabled(false);


                this._isEdited = false;
                this._validationErrors = [];

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

                DisplayStateModel.setData(DisplayData);
                this.getView().setModel(DisplayStateModel, "DisplayActionModel");
                // console.log(this.getView().getModel("DisplayActionModel"));
                // console.log(this.getView());

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
                var oSmartFilter = this.getView().byId("smartFilterBar");
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

                salDocNotxt = oRow.SALESDOCNO;

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

                salDocNotxt = oRow.SALESDOCNO;

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
                        COLUMNNAME: column.sId,
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

            onSearch: function () {
                // this._sbu = this.getView().byId("smartFilterBar").getFilterData().SBU;
                this._sbu = this.getView().byId("cboxSBU").getSelectedKey();

                this.getDynamicTableColumns('SALDOCINIT', 'ZDV_3DERP_SALDOC');
                this.getStatistics("/SalDocStatSet"); //style statistics
                this.byId("_IDGenOverflowToolbars1").setEnabled(true);

                // oTable.placeAt('scTable');
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
                await new Promise((resolve, reject) => {
                    oModel.read("/ColumnsSet", {
                        success: function (oData, oResponse) {
                            if (model === 'SALDOCINIT') {
                                oJSONColumnsModel.setData(oData);
                                me.oJSONModel.setData(oData);
                                me.getView().setModel(oJSONColumnsModel, "DynColumns");  //set the view model
                                me.getDynamicTableData(model);
                                resolve();
                            }else if (model === 'SALDOCCRTSTYLEIO') {
                                tableCol = oData;
                                tableCol.results.push({
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
                                    Order: "017",
                                    Pivot: "",
                                    SortOrder: "",
                                    SortSeq: "",
                                    Sorted: false,
                                    Visible: false
                                })
                                console.log(tableCol)
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

            getDynamicTableData: function (model) {
                var me = this;
                var oModel = this.getOwnerComponent().getModel();

                //get dynamic data
                var oJSONDataModel = new sap.ui.model.json.JSONModel();
                // oModel.setHeaders({
                //     sbu: 'VER',
                //     salesgrp: 'POL',
                //     custgrp: '6A',
                //     season: 'SP21',
                //     prodtyp: '1000',
                //     type: 'STYLINIT'
                // });
                // var aFilters1 = this.getView().byId("smartFilterBar").getFilters();

                var aFilters = this.getView().byId("smartFilterBar").getFilters();
                var oText = this.getView().byId("SalesDocCount");

                var oColumnsModel;
                var oData;
                var oDataModel;

                var oColumnsData;
                var oData;

                // this.addDateFilters(aFilters); //date not automatically added to filters
                if (model === 'SALDOCINIT') {
                    oModel.read("/SALDOCHDRINITSet", {
                        filters: aFilters,
                        success: function (oData, oResponse) {
                            oData.results.forEach(item => {

                                item.DLVDT = dateFormat.format(new Date(item.DLVDT));
                                item.DOCDT = dateFormat.format(new Date(item.DOCDT));
                                item.CPODT = dateFormat.format(new Date(item.CPODT));
                                item.CREATEDTM = timeFormat.format(new Date(item.CREATEDTM.ms + TZOffsetMs));
                                item.UPDATEDTM = timeFormat.format(new Date(item.UPDATEDTM.ms + TZOffsetMs));
                                item.CREATEDDT = dateFormat.format(new Date(item.CREATEDDT));
                                item.UPDATEDDT = dateFormat.format(new Date(item.UPDATEDDT));
                            })
                            oText.setText(oData.results.length + "");
                            oJSONDataModel.setData(oData);
                            me.getView().setModel(oJSONDataModel, "DataModel");

                            var oColumnsModel = me.getView().getModel("DynColumns");
                            var oDataModel = me.getView().getModel("DataModel");

                            var oColumnsData = oColumnsModel.getProperty('/results');
                            var oData = oDataModel.getProperty('/results');

                            me.setTableData(oColumnsData, oData, 'salDocDynTable');
                            me.setChangeStatus(false);
                        },
                        error: function (err) { }
                    });
                } else if (model === 'SALDOCCRTSTYLEIO') {
                    oColumnsModel = me.getView().getModel("SALDOCCRTSTYLEIOCOL");
                    oDataModel = me.getView().getModel("CrtStyleIOData").getData();

                    oColumnsData = oColumnsModel.getProperty('/results');
                    oData = oDataModel === undefined ? [] : oDataModel;

                    this.setTableData(oColumnsData, oData, 'createStyleIOTbl');
                    this.setChangeStatus(false);
                }
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

                //the selected dynamic columns
                // var oColumnsModel = this.getView().getModel("DynColumns");
                // var oDataModel = this.getView().getModel("DataModel");

                // //the selected styles data
                // var oColumnsData = oColumnsModel.getProperty('/results');
                // var oData = oDataModel.getProperty('/results');

                // //add column for copy button
                // oColumnsData.unshift({
                //     "ColumnName": "Copy",
                //     "ColumnType": "COPY",
                //     "Visible": false
                // });

                //add column for manage button
                // oColumnsData.unshift({
                //     "ColumnName": "Manage",
                //     "ColumnType": "SEL",
                //     "Visible": false
                // });

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
                        me.navToDetail(salDocNotxt); //navigate to detail page

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
                        label: sColumnLabel, //"{i18n>" + sColumnId + "}",
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

                //bind the data to the table
                oTable.bindRows("/rows");
            },

            columnTemplate: function (sColumnId, sColumnType) {
                var oColumnTemplate;

                //different component based on field
                if (sColumnId === "STATUS") { //display infolabel for Status Code
                    oColumnTemplate = new sap.tnt.InfoLabel({
                        text: "{" + sColumnId + "}",
                        colorScheme: "{= ${" + sColumnId + "} === 'New' ? 8 : ${" + sColumnId + "} === 'CRT' ? 3 : 1}"
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

            navToDetail: function (salesDocNo, sbu) {
                //route to detail page
                this._router.navTo("RouteSalesDocDetail", {
                    salesdocno: salesDocNo,
                    sbu: this._sbu
                });
            },

            onSearchSaldoc: async function (oEvent) {
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
                                        
                                        if(item.ColumnName === "FTYSTYLE" || item.ColumnName === "WEAVETYP" || item.ColumnName === "STYLECAT"|| item.ColumnName === "SIZEGRP" || item.ColumnName === "PLANMONTH"){
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
                                            item.Visible = true;
                                        }

                                        if (item.ColumnName === "PRODSCEN" || item.ColumnName === "IOTYPE" || item.ColumnName === "PLANMONTH") {
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

                                    oColumnsData.forEach(item =>{
                                        if(item.ColumnName === "PRODSCEN" || item.ColumnName === "IOTYPE"||item.ColumnName === "PLANMONTH" || 
                                           item.ColumnName === "WEAVETYP" || item.ColumnName === "STYLECAT"|| item.ColumnName === "SIZEGRP" || 
                                           item.ColumnName === "PLANMONTH" || item.ColumnName === "FTYSTYLE"){
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
                var sdProcessCd = "";
                var ioNo = "";
                var styleNo = "";
                var createdStyleIONo = []

                var columnData = this.getView().getModel('SALDOCCRTSTYLEIOCOL').getData();
                var oDataModel = me.getView().getModel("CrtStyleIOData").getData(); 
                var oRowData = oDataModel === undefined ? [] :oDataModel;

                if(this.getView().getModel("ui").getData().crtStyleIOMode === "CrtStyle"){
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
                            STYLENO: styleNo,
                            VERNO: aData.at(item).VERNO === "" ? "1" : aData.at(item).VERNO,
                            IONO: ioNo,
                            IOTYPE: aData.at(item).IOTYPE === undefined ? "" : aData.at(item).IOTYPE,
                            PRODSCEN: aData.at(item).PLANMONTH === undefined ? "" : aData.at(item).PLANMONTH
                        })
                    })
                    oParam = oParamHdr;
                    oParam['CrtIOStylData'] = oParamData;
                    oParam['CrtIOStylRetMsg'] = []
                    console.log(oParam);
                    _promiseResult = new Promise((resolve, reject) => {
                        oModel.create("/CrtIOStylHdrSet", oParam, {
                            method: "POST",
                            success: async function(oData, oResponse){
                                console.log(oData);

                                for(var index in columnData.results){
                                    if(columnData.results[index].ColumnName === "LOGDESC"){
                                        columnData.results[index].Visible = true;
                                    }
                                }
                                console.log(columnData);

                                for(var index in oParam.CrtIOStylData){
                                    for(var index2 in oData.CrtIOStylData.results){
                                        if(oParam.CrtIOStylData[index].SALESDOCNO === oData.CrtIOStylData.results[index2].SALESDOCNO){
                                            for(var index3 in oRowData){
                                                if(oRowData[index3].SALESDOCNO === oData.CrtIOStylData.results[index2].SALESDOCNO){
                                                    oRowData[index3].LOGDESC = oData.CrtIOStylData.results[index2].MSG
                                                }
                                            }
                                        }
                                    }
                                }
                                console.log(oRowData)

                                await me.setTableData(columnData.results, oRowData, 'createStyleIOTbl');
                                await me.onRowEditSalDoc('createStyleIOTbl', columnData.results);
                                me.setChangeStatus(false);

                                if(oData.CrtIOStylData.results !== undefined){
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

                    if (createdStyleIONo.length > 0) {
                        if (sdProcessCd === "CRT_STY") {
                            MessageBox.information("Style Successfuly Created!");
                            // this.onCreateStyleIO.destroy(true);
                        }else if(sdProcessCd === "CRT_IO"){
                            MessageBox.information("IO Successfuly Created!");
                            // this.onCreateStyleIO.destroy(true);
                        }else if(sdProcessCd === "CRT_STYIO"){
                            MessageBox.information("IO/Style Successfuly Created!");
                            // this.onCreateStyleIO.destroy(true);
                        }
                    } else {
                        MessageBox.warning("Style/IO Creation Unsuccessful!");
                    }
                    Common.closeLoadingDialog(that);
                }

            },
            onCancelSaldocCreateStyleIO: async function () {
                this.onCreateStyleIO.destroy(true);
            },

            onRowEditSalDoc: async function (table, model) {
                var me = this;
                // this.getView().getModel(model).getData().results.forEach(item => item.Edited = false);
                var oTable = this.byId(table);
                var oColumnsData = model;
                oTable.getColumns().forEach((col, idx) => {
                    oColumnsData.filter(item => item.ColumnName === col.sId.split("-")[1])
                        .forEach(ci => {
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
                                        // id: "ipt" + ci.name,
                                        type: "Text",
                                        value: "{path: '" + ci.ColumnName + "', mandatory: '" + ci.Mandatory + "'}",
                                        maxLength: +ci.Length,
                                        showValueHelp: true,
                                        valueHelpRequest: this.handleValueHelp.bind(this),
                                        liveChange: this.onInputLiveChange.bind(this)
                                    }));
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

                var aFilters = this.getView().byId("smartFilterBar").getFilters();

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

                var aFilters = this.getView().byId("smartFilterBar").getFilters();
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
                                    while (item.Kunnr.length < 10) item.Kunnr = "0" + item.Kunnr;
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

            pad: Common.pad
        });
    });
