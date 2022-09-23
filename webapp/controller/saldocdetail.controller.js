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

        return Controller.extend("zuisaldoc2.zuisaldoc2.controller.saldocdetail", {
            onInit: function () {
                that = this;
                
                //get current userid
                var oModel= new sap.ui.model.json.JSONModel();
                oModel.loadData("/sap/bc/ui2/start_up").then(() => {
                    this._userid = oModel.oData.id;
                })

                this._Model = this.getOwnerComponent().getModel();

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

                //Load details
                this.getDynamicTableColumns();
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
                    type: 'SALDOCDET',
                    tabname: 'ZERP_SALDOCDET'
                    // userid: this._userid
                    // userid: 'BAS_CONN'
                });
                this._Model.read("/ColumnsDetSet", {
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
                oDetColumnsData.unshift({
                    "ColumnName": "ManageDet",
                    "ColumnType": "SEL"
                });

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
                    var sColumnType = context.getObject().ColumnType;
                    var sColumnVisible = context.getObject().Visible;
                    var sColumnSorted = context.getObject().Sorted;
                    var sColumnSortOrder = context.getObject().SortOrder;
                    var sColumnToolTip = context.getObject().Tooltip;
                    //alert(sColumnId.);
                    return new sap.ui.table.Column({
                        // id: sColumnId,
                        label: "{i18n>" + sColumnId + "}",
                        template: me.columnTemplate(sColumnId, sColumnType),
                        width: me.getColumnSize(sColumnId, sColumnType),
                        sortProperty: sColumnId,
                        filterProperty: sColumnId,
                        autoResizable: true,
                        visible: sColumnVisible,
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
                // if (sColumnId === "STATUSCD") { //display infolabel for Status Code
                //     oDetColumnTemplate = new sap.tnt.InfoLabel({
                //         text: "{" + sColumnId + "}",
                //         colorScheme: "{= ${" + sColumnId + "} === 'CMP' ? 8 : ${" + sColumnId + "} === 'CRT' ? 3 : 1}"
                //     })
                // } else 
                if (sColumnType === "SEL") { //Manage button
                    oDetColumnTemplate = new sap.m.Button({
                        text: "",
                        icon: "sap-icon://detail-view",
                        type: "Ghost",
                        // press: this.goToDetail,
                        tooltip: "Manage this Sales Doc Item"
                    });
                    oDetColumnTemplate.data("SALESDOCITEM", "{}"); //custom data to hold style number
                } 
                else {
                    oDetColumnTemplate = new sap.m.Text({ text: "{" + sColumnId + "}" }); //default text
                }
                
                oDetColumnTemplate = new sap.m.Text({ text: "{" + sColumnId + "}" }); //default text
                return oDetColumnTemplate;
            },

            getColumnSize: function (sColumnId, sColumnType) {
                //column width of fields
                var mSize = '7rem';
                if (sColumnType === "SEL") {
                    mSize = '3.5rem';
                } else if (sColumnType === "COPY") {
                    mSize = '3.5rem';
                } else if (sColumnId === "STYLECD") {
                    mSize = '25rem';
                } else if (sColumnId === "DESC1" || sColumnId === "PRODTYP") {
                    mSize = '15rem';
                } else if (sColumnId === "DLVDT" || sColumnId === "DOCDT" || sColumnId === "CREATEDDT" || sColumnId === "UPDATEDDT") {
                    mSize = '30rem';
                }
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
                var oView = this.getView();

                Common.openLoadingDialog(that);

                //read Style header data
                var entitySet = "/SALDOCHDRSet('" + salesDocNo + "')"
                oModel.read(entitySet, {
                    success: function (oData, oResponse) {
                        oJSONModel.setData(oData);
                        oView.setModel(oJSONModel, "headerData");
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
            }
        });
    });