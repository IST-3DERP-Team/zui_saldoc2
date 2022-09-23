sap.ui.define([
	"sap/m/MessageToast" ], function(MessageToast) {
	"use strict";

	return {

		onCancelNewStyle: function() {
			this._ConfirmNewDialog.close();
		},

        onCancelCopyStyles: function() {
			this._ConfirmCopyDialog.close();
		},

        onCancelCopyStyle: function() {
			this._CopyStyleDialog.close();
		},

        onCancelNewVersion: function() {
			this._NewVerionDialog.close();
		},

        onCancelUploadStyle: function() {
            this._UploadStylesDialog.close();
        },

        onCancelUploadFile: function() {
            this._UploadFileDialog.close();
        },

        onExportExcel: function (oEvent) {
            var oButton = oEvent.getSource();
            var tabName = oButton.data('TableName')
            var oTable = this.getView().byId(tabName);
            var oExport = oTable.exportData();
            oExport.mAggregations.columns.shift();
            // var sModel = oTable.data();
            // if (sModel) {
            //     var aExpCol = oExport.getColumns();
                // var aCol = oTable.getColumns();
                // aCol.forEach(function (oColumn, i) {
                //     var oCell = new sap.ui.core.util.ExportCell();
                //     console.log(oCell.getMetadata());
                //     if (oColumn.data("ctype") === "DatePicker") {
                //         oCell.bindProperty("content", { path: sModel + ">" + oColumn.getSortProperty(), formatter: formatter.getDateFormat });
                //         aExpCol[i].setTemplate(oCell);
                //     } else if (oColumn.data("ctype") === "TimePicker") {
                //         oCell.bindProperty("content", { path: sModel + ">" + oColumn.getSortProperty(), formatter: formatter.getTimeFormat });
                //         aExpCol[i].setTemplate(oCell);
                //     }
                // });
            // }
            var date = new Date();

            oExport.saveFile(tabName + " " + date.toLocaleDateString('en-us', { year:"numeric", month:"short", day:"numeric"}));
        },

        pad: function (num, size) {
            num = num.toString();
            while (num.length < size) num = "0" + num;
            return num;
        },

        showMessage: function(oMessage) {
			MessageToast.show(oMessage, {
				duration: 2000,
				animationDuration: 500
			});
		},

        openLoadingDialog: function(doc) {
			if (!doc._LoadingDialog) {
				doc._LoadingDialog = sap.ui.xmlfragment("zuisaldoc2.zuisaldoc2.view.fragments.dialog.LoadingDialog", doc);
				doc.getView().addDependent(doc._LoadingDialog);
			}
			jQuery.sap.syncStyleClass("sapUiSizeCompact", doc.getView(), doc._LoadingDialog);
			doc._LoadingDialog.open();
		},

		closeLoadingDialog: function(doc) {
			doc._LoadingDialog.close();
		}
	};
});