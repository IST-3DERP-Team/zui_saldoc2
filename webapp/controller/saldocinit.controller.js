sap.ui.define([
    "sap/ui/core/mvc/Controller",
    'sap/ui/model/Filter',
    "../js/Common",
    "../js/Utils",
    "sap/ui/model/json/JSONModel",
    "sap/ui/export/Spreadsheet",
    "../control/TableEvents"
    // "../control/DynamicTable"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, Filter, Common, Utils, JSONModel, Spreadsheet, control) {
        "use strict"; 

        var that;
        var salDocNotxt;
        var _promiseResult;

        var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({pattern : "MM/dd/yyyy" });
        var timeFormat = sap.ui.core.format.DateFormat.getTimeInstance({pattern: "KK:mm:ss a"}); 
        var TZOffsetMs = new Date(0).getTimezoneOffset()*60*1000;

        return Controller.extend("zuisaldoc2.zuisaldoc2.controller.saldocinit", {
            onInit: function (oEvent) {
                that = this; 
                
                //get current userid
                var oModel= new sap.ui.model.json.JSONModel();
                oModel.loadData("/sap/bc/ui2/start_up").then(() => {
                    this._userid = oModel.oData.id;
                })

                var oComponent = this.getOwnerComponent();
                this._router = oComponent.getRouter();
                // this._router.getRoute("RouteSalesDocHdr").attachPatternMatched(this._routePatternMatched, this);

                this._Model = this.getOwnerComponent().getModel();
                this.setSmartFilterModel();                  
                // this.onSearch();
            },
            setSmartFilterModel: function () {
                //Model StyleHeaderFilters is for the smartfilterbar
                var oModel = this.getOwnerComponent().getModel("ZVB_3DERP_SALDOC_FILTERS_CDS");
                // console.log(oModel)
                var oSmartFilter = this.getView().byId("smartFilterBar");
                oSmartFilter.setModel(oModel);
                
                // console.log(oModel)

                // oModel.read("/ZVB_3DERP_VENDOR_SH", {
                //     success: function (oData, oResponse) {
                //         console.log(oData)
                //     },
                //     error: function (err) { 
                //     }
                // });
            },
            
            onRowChange: async function(oEvent) {
                var me = this;
                var sPath = oEvent.getParameter("rowContext");
                sPath = "/results/"+ sPath.getPath().split("/")[2];
                var selPath = this.byId(oEvent.getParameters().id).mProperties.selectedIndex;

                var oTable = this.getView().byId("salDocDynTable");
                var model = oTable.getModel();

                var oRow = this.getView().getModel("DataModel").getProperty(sPath)

                salDocNotxt = oRow.SALESDOCNO;
                
                console.log(salDocNotxt);
                _promiseResult = new Promise((resolve, reject)=>{
                    oTable.getRows().forEach(row => {
                        if(row.getBindingContext().sPath.replace("/rows/", "") === sPath.split("/")[2]){
                            resolve(row.addStyleClass("activeRow"));
                            oTable.setSelectedIndex(selPath);
                        }else{
                            resolve(row.removeStyleClass("activeRow"));
                        }
                    });
                });

                //get the selected  data from the model and set to variable style
                // var data = model.getProperty(sPath);
                // salDocNotxt = data['SALESDOCNO'];

                // var oTable = this.getView().byId("salDocDynTable");
                // var aSelRows = oTable.getSelectedIndices();
                // console.log(oTable);
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
            onCellClick: async function(oEvent){
                var sRowPath = oEvent.getParameters().rowBindingContext.sPath;
                sRowPath = "/results/"+ sRowPath.split("/")[2];
                var oRow = this.getView().getModel("DataModel").getProperty(sRowPath)
                var oTable = this.getView().byId("salDocDynTable");

                salDocNotxt = oRow.SALESDOCNO;

                _promiseResult = new Promise((resolve, reject)=>{
                    oTable.getRows().forEach(row => {
                        if(row.getBindingContext().sPath.replace("/rows/", "") === sRowPath.split("/")[2]){
                            resolve(row.addStyleClass("activeRow"));
                        }else{
                            resolve(row.removeStyleClass("activeRow"));
                        }
                    });
                });
                await _promiseResult;

            },
            onSaveTableLayout: function(){
                var type = "SALDOCINIT";
                var tabName = "ZDV_3DERP_SALDOC";
                var vSBU =  this._sbu;
                
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
                        WIDTH: column.mProperties.width.replace('rem','')
                    });
    
                    ctr++;
                });
    
                //call the layout save
                var oModel = this.getOwnerComponent().getModel("ZGW_3DERP_COMMON_SRV");

                oModel.create("/TableLayoutSet", oParam, {
                    method: "POST",
                    success: function(data, oResponse) {
                        sap.m.MessageBox.information("Layout saved.");
                        //Common.showMessage(me._i18n.getText('t6'));
                    },
                    error: function(err) {
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

            setChangeStatus: function(changed) {
                //Set change flag 
                try {
                    sap.ushell.Container.setDirtyFlag(changed);
                } catch (err) {}
            },

            onSearch: function () {
                // this._sbu = this.getView().byId("smartFilterBar").getFilterData().SBU;
                this._sbu = this.getView().byId("cboxSBU").getSelectedKey();
                // console.log(this._sbu);

                this.getDynamicTableColumns();
                this.getStatistics("/SalDocStatSet"); //style statistics

                // oTable.placeAt('scTable');
            },

            getDynamicTableColumns: function () {
                var me = this;

                //get dynamic columns based on saved layout or ZERP_CHECK
                var oJSONColumnsModel = new sap.ui.model.json.JSONModel();
                this.oJSONModel = new sap.ui.model.json.JSONModel();
                var oModel = this.getOwnerComponent().getModel("ZGW_3DERP_COMMON_SRV");
                                
                // this._sbu = this.getView().byId("cboxSBU").getSelectedKey();
                
                console.log(this._sbu);
                
                oModel.setHeaders({
                    sbu: this._sbu,
                    type: 'SALDOCINIT',
                    tabname: 'ZDV_3DERP_SALDOC'
                });
                
                //DynamicColumnsSet
                oModel.read("/ColumnsSet", {
                    success: function (oData, oResponse) {
                        oJSONColumnsModel.setData(oData);
                        me.oJSONModel.setData(oData);
                        me.getView().setModel(oJSONColumnsModel, "DynColumns");  //set the view model
                        me.getDynamicTableData(oData.results);
                    },
                    error: function (err) { }
                });
            },

            getDynamicTableData: function (columns) {
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

                // this.addDateFilters(aFilters); //date not automatically added to filters

                oModel.read("/SALDOCHDRINITSet", {
                    filters: aFilters,
                    success: function (oData, oResponse) {
                        
                        console.log(oData)
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
                        me.setTableData();
                        me.setChangeStatus(false);
                    },
                    error: function (err) { }
                });
            },

            addDateFilters: function(aFilters) {
                //get the date filter of created date
                var createdDate = this.getView().byId("CreatedDatePicker").getValue();
                    if(createdDate !== undefined && createdDate !== '') {
                        createdDate = createdDate.replace(/\s/g, '').toString(); //properly format the date for ABAP
                        var createDateStr = createdDate.split('–');
                        var createdDate1 = createDateStr[0];
                        var createdDate2 = createDateStr[1];
                        if(createdDate2 === undefined) {
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
                    if(updatedDate !== undefined && updatedDate !== '') {
                        updatedDate = updatedDate.replace(/\s/g, '').toString(); //properly format the date for ABAP
                        var createDateStr = updatedDate.split('–');
                        var updatedDate1 = createDateStr[0];
                        var updatedDate2 = createDateStr[1];
                        if(updatedDate2 === undefined) {
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
            
            setTableData: function () {
                var me = this;

                //the selected dynamic columns
                var oColumnsModel = this.getView().getModel("DynColumns");
                var oDataModel = this.getView().getModel("DataModel");

                //the selected styles data
                var oColumnsData = oColumnsModel.getProperty('/results');
                var oData = oDataModel.getProperty('/results');

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

                var oDelegateKeyUp = {
                    onkeyup: function (oEvent) {
                        that.onKeyUp(oEvent);
                    },

                    onsapenter: function (oEvent) {
                        that.onSapEnter(oEvent);
                    }
                };

                this.byId("salDocDynTable").addEventDelegate(oDelegateKeyUp);

                var oTable = this.getView().byId("salDocDynTable");
                oTable.setModel(oModel);

                oTable.attachBrowserEvent('dblclick', function (e) {
                    e.preventDefault();
                    me.setChangeStatus(false); //remove change flag
                    me.navToDetail(salDocNotxt); //navigate to detail page

                });

                console.log(oTable);

                //bind the dynamic column to the table
                oTable.bindColumns("/columns", function (index, context) {
                    console.log(context.getObject());
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
                        id: sColumnId,
                        label: sColumnLabel, //"{i18n>" + sColumnId + "}",
                        template: me.columnTemplate(sColumnId, sColumnType),
                        width: me.getFormatColumnSize(sColumnId, sColumnType, sColumnWidth) + 'px',
                        sortProperty: sColumnId,
                        filterProperty: sColumnId,
                        autoResizable: true,
                        visible: sColumnVisible ,
                        sorted: sColumnSorted,
                        sortOrder: ((sColumnSorted === true) ? sColumnSortOrder : "Ascending" )
                    });
                });

                //bind the data to the table
                oTable.bindRows("/rows");
            },

            columnTemplate: function (sColumnId, sColumnType) {
                var oColumnTemplate;
                
                //different component based on field
                if (sColumnId === "STATUS") { //display infolabel for Status Code
                    // console.log(sColumnId);
                    oColumnTemplate = new sap.tnt.InfoLabel({
                        text: "{" + sColumnId + "}",
                        colorScheme: "{= ${" + sColumnId + "} === 'New' ? 8 : ${" + sColumnId + "} === 'CRT' ? 3 : 1}"
                    })
                }else if (sColumnId === "STATUSCD") { //display infolabel for Status Code
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

            onKeyUp: async function(oEvent) {
                if ((oEvent.key === "ArrowUp" || oEvent.key === "ArrowDown") && oEvent.srcControl.sParentAggregationName === "rows") {
                    var oTable = this.getView().byId("salDocDynTable");

                    var sRowPath = this.byId(oEvent.srcControl.sId).oBindingContexts["undefined"].sPath;
                    var index = sRowPath.split("/");
                    _promiseResult = new Promise((resolve,reject)=> {
                        oTable.getRows().forEach(row => {
                            if(row.getBindingContext().sPath.replace("/rows/", "") === index[2]){
                                resolve(row.addStyleClass("activeRow"));
                            }else{
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
                console.log(this._aSBU);
                that.navToDetail(salDocNotxt, this._aSBU); //navigate to detail page
            },

            goToDetail: function (oEvent) {
                var oButton = oEvent.getSource();
                var salesDocNo = oButton.data("SALESDOCNO").SALESDOCNO; //get the styleno binded to manage button
                that.setChangeStatus(false); //remove change flag
                // alert(salesDocNo);
                that.navToDetail(salesDocNo); //navigate to detail page
            },
            addNewDetail: async function(){
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

                console.log(aFilters);
                
                var vEntitySet = EntitySet;

                this._Model.read(vEntitySet, {
                    filters: aFilters,
                    success: function (oData) {
                        console.log(oData);
                        oForecast.setNumber(oData.results[0].FORECASTQTY);
                        oOrder.setNumber(oData.results[0].ORDERQTY);
                        oShipped.setNumber(oData.results[0].SHIPQTY);
                    },
                    error: function (err) { }
                });
            },

            pad: Common.pad
        });
    });
