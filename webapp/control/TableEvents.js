var currentRowIndex;
sap.ui.define([
	"sap/ui/table/Table"
], function(Table) {
	return sap.ui.table.Table.extend("TableEvents", {
        metadata: {
            events: {
              dblClick: {}
            }
          },
          renderer: {},
          onAfterRendering: function() {
            if (sap.ui.table.Table.prototype.onAfterRendering) {
              sap.ui.table.Table.prototype.onAfterRendering.apply(this, arguments);
            }
            var tbl = this;
            
            this.getRows().forEach(function(r, i) {
              var cxt = tbl.getContextByIndex(i);
              if (cxt) {        
                r.$().dblclick(function() {
                  tbl.fireDblClick({rowIndex: i, rowContext: cxt});
                });
              }
            });
            
            this.$().find('.sapUiTableRowHdr').each(function(i) {
              var cxt = tbl.getContextByIndex(i);
              if (cxt) {        
                $(this).dblclick(function() {
                  tbl.fireDblClick({rowIndex: i, rowContext: cxt});
                });
              }
            });
          }
	});
});