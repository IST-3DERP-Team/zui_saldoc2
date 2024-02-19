sap.ui.define([
        "sap/ui/core/UIComponent",
        "sap/ui/Device",
        "zuisaldoc2/zuisaldoc2/model/models"
    ],
    function (UIComponent, Device, models) {
        "use strict";

        return UIComponent.extend("zuisaldoc2.zuisaldoc2.Component", {
            metadata: {
                manifest: "json",
                config: { fullWidth: true }
            },

            /**
             * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
             * @public
             * @override
             */
            init: function () {
                // call the base component's init function
                UIComponent.prototype.init.apply(this, arguments);

                // enable routing
                this.getRouter().initialize();

                // set the device model
                this.setModel(models.createDeviceModel(), "device");
            },
            
            destroy: function () {

                if (this.oRouteHandler) {

                    this.oRouteHandler.destroy();

                }

                sap.ui.core.UIComponent.prototype.destroy.apply(this, arguments);

            }
        });
    }
);