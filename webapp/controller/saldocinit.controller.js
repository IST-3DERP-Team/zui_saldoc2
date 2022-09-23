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
            onCellClick: function() {
                var oTable = this.getView().byId("salDocDynTable");
                var aSelRows = oTable.getSelectedIndices();
                console.log(aSelRows.Length);
                if (aSelRows.length > 0) 
                aSelRows.forEach(rec => {
                    var oContext = oTable.getContextByIndex(rec);
                    var vSALDOCNO = oContext.getObject().SALESDOCNO;
                    salDocNotxt = vSALDOCNO;
                    // var oEntitySet = "/GMCSet('" + vGmc + "')";
                    // var oParam = {
                    //     "Deleted": "X"
                    });

                    alert(salDocNotxt);
            },

            ondblClick: function(oEvent) {
                console.log(oEvent);
                alert("Double Clicked!");
            },
            
            onRowChange: function() {
                var oTable = this.getView().byId("salDocDynTable");
                var aSelRows = oTable.getSelectedIndices();
                console.log(oTable);
                if (aSelRows.length > 0) 
                aSelRows.forEach(rec => {
                    var oContext = oTable.getContextByIndex(rec);
                    var vSALDOCNO = oContext.getObject().SALESDOCNO;
                    salDocNotxt = vSALDOCNO;
                    // var oEntitySet = "/GMCSet('" + vGmc + "')";
                    // var oParam = {
                    //     "Deleted": "X"
                    });

                    this.goToDetailClick(salDocNotxt);
            },

            setChangeStatus: function(changed) {
                //Set change flag 
                try {
                    sap.ushell.Container.setDirtyFlag(changed);
                } catch (err) {}
            },

            onSearch: function () {

                // var oTable = new TableEvents({
                //     selectionMode: sap.ui.table.SelectionMode.Single,
                //     dblClick: function(e) {
                //        sap.m.MessageToast.show(JSON.stringify(e.getParameter('rowContext').getObject()));
                //     }
                //   });

                this.getDynamicTableColumns();
                // this.getStyleStats(); //style statistics

                // oTable.placeAt('scTable');
            },

            getDynamicTableColumns: function () {
                var me = this;

                //get dynamic columns based on saved layout or ZERP_CHECK
                var oJSONColumnsModel = new sap.ui.model.json.JSONModel();
                this.oJSONModel = new sap.ui.model.json.JSONModel();
                                
                // this._SBU = this.getView().byId("SmartFilterBar").getFilterData().SBU;  //get selected SBU
                this._sbu = 'VER'
                this._Model.setHeaders({
                    sbu: this._sbu,
                    type: 'SALDOCINIT',
                    tabname: 'ZERP_SALDOCHDR'
                    // ,
                    // userid: this._userid
                    // userid: 'BAS_CONN'
                });
                
                //DynamicColumnsSet
                this._Model.read("/ColumnsSet", {
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

                // var selectString = "";
                // var lv1 = "Col";
                // var i = 1;
                // var statusColNo;

                // //build select columns
                // var oColCount = columns.length;
                // columns.forEach((column) => {
                //     // console.log(columns);
                //     if (column.ColumnName === "STATUS")
                //         statusColNo = i;

                //     if (column.ColumnName === "SALESDOCNO")
                //         this._StyleNoColNo = i;

                //     var lv2 = this.pad(i, 3);
                //     i++;

                //     var colString = lv1 + lv2;
                //     selectString += colString + ",";
                // })
                // selectString = selectString.slice(0, -1);

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
                // var aFilters = this.getView().byId("SmartFilterBar").getFilters();
                var oText = this.getView().byId("SalesDocCount");

                // this.addDateFilters(aFilters); //date not automatically added to filters

                oModel.read("/SALDOCHDRSet", {
                    // filters: aFilters,
                    success: function (oData, oResponse) {
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
                oColumnsData.unshift({
                    "ColumnName": "Manage",
                    "ColumnType": "SEL"
                });

                //set the column and data model
                var oModel = new JSONModel();
                oModel.setData({
                    columns: oColumnsData,
                    rows: oData
                });

                var oTable = this.getView().byId("salDocDynTable");
                oTable.setModel(oModel);

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
                        id: sColumnId,
                        label: sColumnLabel, //"{i18n>" + sColumnId + "}",
                        template: me.columnTemplate(sColumnId, sColumnType),
                        width: me.getFormatColumnSize(sColumnId, sColumnType, sColumnWidth) + 'rem',
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
                    console.log(sColumnId);
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
                        tooltip: "Manage this Sales Doc"
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
                    oColumnTemplate = new sap.m.Text({ text: "{" + sColumnId + "}" }); //default text
                }

                return oColumnTemplate;
            },

            getColumnSize: function (sColumnId, sColumnType) {
                //column width of fields
                var mSize = '7';
                if (sColumnType === "SEL") {
                    mSize = '3.5';
                } else if (sColumnType === "COPY") {
                    mSize = '3.5';
                } else if (sColumnId === "STYLECD") {
                    mSize = '25';
                } else if (sColumnId === "DESC1" || sColumnId === "PRODTYP") {
                    mSize = '15';
                } else if (sColumnId === "DLVDT" || sColumnId === "DOCDT" || sColumnId === "CREATEDDT" || sColumnId === "UPDATEDDT") {
                    mSize = '30';
                }
                return mSize;
            },

            getFormatColumnSize: function (sColumnId, sColumnType, sColumnSize) {
                //column width of fields
                var mSize = sColumnSize;
                if (sColumnType === "SEL") {
                    mSize = '3.5';
                } else if (sColumnType === "COPY") {
                    mSize = '3.5';
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

            goToDetail: function (oEvent) {
                var oButton = oEvent.getSource();
                var salesDocNo = oButton.data("SALESDOCNO").SALESDOCNO; //get the styleno binded to manage button
                that.setChangeStatus(false); //remove change flag
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
                that._router.navTo("RouteSalesDocDetail", {
                    salesdocno: salesDocNo,
                    sbu: that._sbu
                });
            },

            onSalesDocReader: function () {
                var oModel = this.getOwnerComponent().getModel();
                var oForecast = this.getView().byId("forecastNumber");
                var oOrder = this.getView().byId("orderNumber");
                var oShipped = this.getView().byId("shippedNumber");

                var aFilters = this.getView().byId("SmartFilterBar").getFilters();

                oModel.read("/StyleStatsSet", {
                    filters: aFilters,
                    success: function (oData) {
                        oForecast.setNumber(oData.results[0].FORECAST);
                        oOrder.setNumber(oData.results[0].ORDER);
                        oShipped.setNumber(oData.results[0].SHIPPED);
                    },
                    error: function (err) { }
                });
            },

            pad: Common.pad
        });
    });
