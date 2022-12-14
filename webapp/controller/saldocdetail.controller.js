sap.ui.define([
    "sap/ui/core/mvc/Controller",
    'sap/ui/model/Filter',
    "../js/Common",
    "../js/Utils",
    "sap/ui/model/json/JSONModel",
    'jquery.sap.global',
    'sap/ui/core/routing/HashChanger',
    'sap/m/MessageStrip',
    "../control/DynamicTable"
],
    /** 
     * @param {typeof sap.ui.core.mvc.Controller} Controller 
     */
    function (Controller, Filter, Common, Utils, JSONModel, jQuery, HashChanger, MessageStrip, control) {
        "use strict"; 

        var that;
        
        var Core = sap.ui.getCore();
        var _promiseResult;

        var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({pattern : "MM/dd/yyyy" });
        var timeFormat = sap.ui.core.format.DateFormat.getTimeInstance({pattern: "KK:mm:ss a"}); 
        var TZOffsetMs = new Date(0).getTimezoneOffset()*60*1000;

        return Controller.extend("zuisaldoc2.zuisaldoc2.controller.saldocdetail", {
            onInit: function () {
                that = this;
                
                //get current userid
                var oModel= new sap.ui.model.json.JSONModel();
                oModel.loadData("/sap/bc/ui2/start_up").then(() => {
                    this._userid = oModel.oData.id;
                })

                this._Model = this.getOwnerComponent().getModel();
                this._Model2 = this.getOwnerComponent().getModel("ZGW_3DERP_COMMON_SRV");

                //Initialize router
                var oComponent = this.getOwnerComponent();
                this._router = oComponent.getRouter();
                this._router.getRoute("RouteSalesDocDetail").attachPatternMatched(this._routePatternMatched, this);                
            },

            _routePatternMatched: function (oEvent) {
                this._salesDocNo = oEvent.getParameter("arguments").salesdocno; //get Style from route pattern
                this._sbu = oEvent.getParameter("arguments").sbu; //get SBU from route pattern

                //set all as no changes at first load
                this._headerChanged = false;

                //set Change Status    
                this.setChangeStatus(false);
                
                if (this._salesDocNo === "NEW") { 
                    //create new - only header is editable at first
                    this.setHeaderEditMode(); 
                    // this.setDetailVisible(false);
                }else {
                    //existing style, get the style data
                    this.cancelHeaderEdit(); 
                    // this.setDetailVisible(true); //make detail section visible
                }
                
                //Load header
                this.getHeaderConfig(); //get visible header fields
                this.getHeaderData(); //get header data
                
                // build Dynamic table for Sales Document Details
                setTimeout(() => {
                    this.getDynamicTableColumns(); 
                },100);
            },

            getDynamicTableColumns: function () {
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
                oModel.read("/ColumnsSet", {
                    success: function (oData, oResponse) {
                        oJSONColumnsModel.setData(oData);
                        me.oJSONModel.setData(oData);
                        me.getView().setModel(oJSONColumnsModel, "DetDynColumns");  //set the view model
                        me.getDynamicTableData(oData.results);
                    },
                    error: function (err) { }
                });
            },

            getDynamicTableData: function (columns) {
                var me = this;
                var oModel = this.getOwnerComponent().getModel();
                var oJSONDataModel = new sap.ui.model.json.JSONModel();

                var salesDocNo = this._salesDocNo;

                var oText = this.getView().byId("SalesDocDetCount");
                
                oModel.read("/SALDOCDETSet", {
                    urlParameters: {
                        "$filter": "SALESDOCNO eq '" + salesDocNo + "'"
                    },
                    success: function (oData, oResponse) { 
                        console.log(oData);
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
                         template: me.columnTemplate(sColumnId, sColumnType,"Stat"),
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
                oDetTable.bindRows("/rows");
            },

            columnTemplate: function (sColumnId, sColumnType) {
                var oDetColumnTemplate;
                
                //different component based on field
                
                oDetColumnTemplate = new sap.m.Text({ text: "{" + sColumnId + "}", wrapping: false }); //default text
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

            setChangeStatus: function(changed) {
                //controls the edited warning message
                try {
                    sap.ushell.Container.setDirtyFlag(changed);
                } catch(err) {}
            },

            getHeaderConfig: function () {
                var me = this;
                var oView = this.getView();
                var oModel = this.getOwnerComponent().getModel();
                var oJSONModel = new sap.ui.model.json.JSONModel();

                //get header fields
                oModel.setHeaders({
                    sbu: this._sbu,
                    type: 'SALDOCHDR',
                    userid: this._userid
                });
                oModel.read("/DynamicColumnsSet", {
                    success: function (oData, oResponse) {
                        var visibleFields = new JSONModel();
                        var visibleFields = {};
                        //get only visible fields
                        for (var i = 0; i < oData.results.length; i++) {
                            visibleFields[oData.results[i].ColumnName] = oData.results[i].Visible;
                        }
                        var JSONdata = JSON.stringify(visibleFields);
                        var JSONparse = JSON.parse(JSONdata);
                        oJSONModel.setData(JSONparse);
                        oView.setModel(oJSONModel, "VisibleFieldsData");
                    },
                    error: function (err) { }
                });

            },

            getHeaderData: function () {
                var me = this;
                var salesDocNo = this._salesDocNo;
                var oModel = this.getOwnerComponent().getModel();
                var oJSONModel = new JSONModel();
                // var oJSONDataModel = new sap.ui.model.json.JSONModel();
                
                var oView = this.getView();

                Common.openLoadingDialog(that);

                //read Style header data
                // var entitySet = "/SALDOCHDRSet('" + salesDocNo + "')"
                // oModel.read(entitySet, {

                // console.log(salesDocNo);

                //     oModel.read("/SALDOCHDRSet", {
                //         urlParameters: {
                //             "$filter": "SALESDOCNO eq '" + salesDocNo + "'"
                //         },

                // read Style header data
                var entitySet = "/SALDOCHDRSet('" + salesDocNo + "')"
                oModel.read(entitySet, {
                    success: function (oData, oResponse) {
                        // console.log(oData);
                        // oData.results.forEach(item => {
                        //     item.CPODT = dateFormat.format(item.CPODT);
                        //     item.DLVDT = dateFormat.format(item.DLVDT);
                        //     item.CREATEDDT = dateFormat.format(item.CREATEDDT);
                        //     item.UPDATEDDT = dateFormat.format(item.UPDATEDDT);
                        // })
                        oJSONModel.setData(oData);
                        oView.setModel(oJSONModel, "headerData");

                        // oJSONDataModel.setData(oData);
                        // oView.setModel(oJSONDataModel, "headerData");

                        Common.closeLoadingDialog(that);
                        me.setChangeStatus(false);
                    },
                    error: function () {
                        Common.closeLoadingDialog(that);
                    }
                })
            },

            setHeaderEditMode: function () {
                //unlock editable fields of style header
                var oJSONModel = new JSONModel();
                var data = {};
                this._headerChanged = false;
                data.editMode = true;
                oJSONModel.setData(data);
                this.getView().setModel(oJSONModel, "HeaderEditModeModel"); 
            },

            // setDetailVisible: function(bool) {
            //     var detailPanel = this.getView().byId('detailPanel'); //show detail section if there is header info
            //     detailPanel.setVisible(bool);
            // },

            cancelHeaderEdit: function () {
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
                    this.closeHeaderEdit();
                }
            },

            closeHeaderEdit: function () {
                //on cancel confirmed - close edit mode and reselect backend data
                var oJSONModel = new JSONModel();
                var data = {};
                that._headerChanged = false;
                that.setChangeStatus(false);
                data.editMode = false;
                oJSONModel.setData(data);
                that.getView().setModel(oJSONModel, "HeaderEditModeModel");
                if (that._DiscardHeaderChangesDialog) {
                    that._DiscardHeaderChangesDialog.close();
                    that.getHeaderData();
                }
                var oMsgStrip = that.getView().byId('HeaderMessageStrip');
                oMsgStrip.setVisible(false);
            },

            onRowChange: async function(oEvent) {
                var sPath = oEvent.getParameter("rowContext");
                sPath = "/results/"+ sPath.getPath().split("/")[2];
                var selPath = this.byId(oEvent.getParameters().id).mProperties.selectedIndex;

                var oTable = this.getView().byId("salDocDetDynTable");

                var oRow = this.getView().getModel("DetDataModel").getProperty(sPath)

                _promiseResult = new Promise((resolve, reject)=>{
                    oTable.getRows().forEach(row => {
                        if(row.getBindingContext().sPath.replace("/rows/", "") === sPath.split("/")[2]){
                            resolve(row.addStyleClass("activeRow"));
                        }else{
                            resolve(row.removeStyleClass("activeRow"));
                        }
                    });
                });
            },
            onCellClick: async function(oEvent){
                var sRowPath = oEvent.getParameters().rowBindingContext.sPath;
                sRowPath = "/results/"+ sRowPath.split("/")[2];
                var oRow = this.getView().getModel("DetDataModel").getProperty(sRowPath)
                var oTable = this.getView().byId("salDocDetDynTable");

                // salDocNotxt = oRow.SALESDOCNO;

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
                var type = "SALDOCDET";
                var tabName = "ZERP_SALDOCDET";
                var vSBU =  this._sbu;
                
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
        });
    });