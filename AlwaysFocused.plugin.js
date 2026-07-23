/**
 * @name AlwaysFocused
 * @author Wtjwtjwtjwtj
 * @description AlwaysFocused forces Discord to treat the app as always focused, keeping GIFs animated when tabbed out. This can be useful when you are using split screen on one monitor, or if you have multiple monitors and Discord is on one of the screens.
 * @version 3.0.0
 */

module.exports = class AlwaysFocused {
    start() {
        // 1. Override document focus and visibility APIs
        this._originalHasFocus = document.hasFocus;
        document.hasFocus = () => true;

        Object.defineProperty(document, 'hidden', {
            get: () => false,
            configurable: true
        });

        Object.defineProperty(document, 'visibilityState', {
            get: () => 'visible',
            configurable: true
        });

        // 2. Intercept window event listeners to block blur and visibility change events
        this._originalAddEventListener = window.addEventListener;
        window.addEventListener = (type, listener, options) => {
            if (['blur', 'visibilitychange', 'pagehide', 'freeze'].includes(type)) {
                return;
            }
            return this._originalAddEventListener.call(window, type, listener, options);
        };

        // 3. Find and patch Discord's internal Event Dispatcher
        let dispatcher = BdApi.Webpack.getByKeys("dispatch", "subscribe", { searchExports: true }) ||
                         BdApi.Webpack.getModule(m => m && typeof m.dispatch === "function" && typeof m.subscribe === "function", { searchExports: true });
        
        if (dispatcher && typeof dispatcher.dispatch === "function") {
            BdApi.Patcher.before("AlwaysFocused", dispatcher, "dispatch", (_, args) => {
                const event = args[0];
                if (!event) return;
                
                if (event.type === "APP_STATE_UPDATE") {
                    event.state = "active";
                }
                if (event.type === "WINDOW_FOCUSED" || event.type === "WINDOW_BLUR") {
                    event.type = "WINDOW_FOCUSED";
                    event.focused = true;
                }
                if (event.type === "SET_FOCUS") {
                    event.focused = true;
                }
            });
        }

        // 4. Patch any internal Focus/App State stores found in Webpack
        const modules = BdApi.Webpack.getModules(m => m && (typeof m.isFocused === "function" || typeof m.isAppFocused === "function"));
        if (modules) {
            for (const mod of modules) {
                if (typeof mod.isFocused === "function") {
                    BdApi.Patcher.instead("AlwaysFocused", mod, "isFocused", () => true);
                }
                if (typeof mod.isAppFocused === "function") {
                    BdApi.Patcher.instead("AlwaysFocused", mod, "isAppFocused", () => true);
                }
            }
        }

        BdApi.UI.showToast("AlwaysFocused enabled: GIFs will stay animated.", { type: "success" });
    }

    stop() {
        if (this._originalHasFocus) {
            document.hasFocus = this._originalHasFocus;
        }
        if (this._originalAddEventListener) {
            window.addEventListener = this._originalAddEventListener;
        }
        
        delete document.hidden;
        delete document.visibilityState;

        BdApi.Patcher.unpatchAll("AlwaysFocused");
        BdApi.UI.showToast("AlwaysFocused disabled.", { type: "info" });
    }
};
