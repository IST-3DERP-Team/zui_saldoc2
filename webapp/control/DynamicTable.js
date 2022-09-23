var currentRowIndex;
sap.ui.define([
	"sap/ui/table/Table"
], function(Table) {
	return Table.extend("Table_Binding.DynamicTable", {
		onInit: function() {

		},

		insertRows: function(value, table, model, startRowIndex, startProperty) {

			var oTableLength = table.getModel(model).getData().results.length;

			var rows = value.split(/\n/);
		
			var sNewCopiedData;
			// if (currentRowIndex !== 0) {
			// 	sNewCopiedData = rows.slice(0, currentRowIndex-1);
			// } else {
				sNewCopiedData = rows.slice(0, oTableLength+1);
			// }
            var cells = table.getRows()[0].getCells()
			// var cells = table.getBindingInfo('rows').template.getCells();
			var templateItem = [];
			var itemsPath = table.getBindingPath('rows');
			var itemsArray = table.getModel(model).getProperty(itemsPath);
			var startPropertyIndex = 0;
			var model = table.getModel(model);
			var fData = model.oData.Data;

			if (startPropertyIndex === 2) {

				for (var i = 0; i < fData.length; i++) {

					for (var int = 0; int < sNewCopiedData.length - 1; int++) {
						var rows_element = sNewCopiedData[int];
						fData[i].Number = rows_element;
					
					}

				}
			} else if (startPropertyIndex === 3) {
				for (var q = 0; q < fData.length; q++) {

					for (var w = 0; w < sNewCopiedData.length - 1; w++) {
						var row = sNewCopiedData[w];
						fData[q].Email = row;
					
					}

				}
			}

			if (startRowIndex === undefined) {
				startRowIndex = 0;
			}
			for (var int = 0; int < cells.length; int++) {
				var cell_element = cells[int];
				var path = cell_element.getBindingPath('value');
				templateItem.push(path);
				if (path === startProperty) {
					startPropertyIndex = int;
				}

			}

			for (var int = 0; int < sNewCopiedData.length - 1; int++) {
				var rows_element = sNewCopiedData[int];
				var cells = rows_element.split(/\t/);

				var originalObject = model.getProperty(itemsPath + "/" + startRowIndex++);
				if (originalObject === undefined) {
					originalObject = {};
					for (var k = 0; k < templateItem.length; k++) {
						originalObject[templateItem[k]] = undefined;
					}
					// itemsArray.push(originalObject);
				}

				var lesserLength = Math.min(templateItem.length, (cells.length + startPropertyIndex));
				for (int2 = startPropertyIndex, intValue = 0; int2 < lesserLength; int2++, intValue++) {
					var name = templateItem[int2];
					originalObject[name] = cells[intValue];

				}

			}
			model.refresh();

		},
		onAfterRendering: function() {
			var that = this;
			// sap.m.Table.prototype.onAfterRendering.apply(this, arguments);
			sap.ui.table.Table.prototype.onAfterRendering.apply(this, arguments);
            var tbl = this;

            this.attachBrowserEvent('paste', function(e) {
				e.preventDefault();
				var text = (e.originalEvent || e).clipboardData.getData('text/plain');

				that.insertRows(text, this, undefined);
			});
			this.getAggregation('rows').forEach(function(row) {
				row.getCells().forEach(function(cell) {
					cell.attachBrowserEvent('paste', function(e) {
						e.stopPropagation();

						e.preventDefault();
						var text = (e.originalEvent || e).clipboardData.getData('text/plain');
						var domCell = jQuery.sap.domById(e.currentTarget.id);
						var insertCell = jQuery('#' + domCell.id).control()[0];
						var itemsPath = that.getBindingPath('rows');
						var pathRow = insertCell.getBindingContext('DataModel').sPath;

						currentRowIndex = parseInt(pathRow.substring(pathRow.lastIndexOf('/') + 1)); //Selected row index

						var startRowIndex = pathRow.split(itemsPath + "/")[1];
						var startProperty = insertCell.getBindingPath('value');
						that.insertRows(text, that, 'DataModel', startRowIndex, startProperty);
					});
				});
			});
		},
		// renderer: sap.m.Table.prototype.getRenderer()
        renderer: sap.ui.table.Table.prototype.getRenderer()

	});
});