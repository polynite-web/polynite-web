/* version.js */
(function(){
    "use strict";

    var VERSION_FILE = "version.txt";
    var DEFAULT_VERSION = "dev";

    /* Same reason as above: scope what is left in storage to this app's own
       path, so two apps under one host never read each other's counters. */
    var SCOPE = (function(){
        try{ return location.pathname.replace(/[^/]*$/, ""); }
        catch(error){ return "/"; }
    })();
    var VERSION_KEY = "siteVersion:" + SCOPE;
    var RELOAD_KEY = "lastReloadVersion:" + SCOPE;

    function isLocalDevelopmentHost(){
        var host = location.hostname;

        return (
            host === "localhost" ||
            host === "127.0.0.1" ||
            host === "::1" ||
            host.indexOf("192.168.") === 0
        );
    }

    function hasDebugParameter(){
        return /(?:^|[?&])(?:dev|debug)(?:[=&]|$)/i.test(location.search);
    }

    function readStorage(storage,key){
        try{
            return storage.getItem(key) || "";
        }
        catch(error){
            return "";
        }
    }

    function writeStorage(storage,key,value){
        try{
            storage.setItem(key,value);
        }
        catch(error){
        }
    }

    function getPageVersion(){
        try{
            return (
                new URL(location.href)
                    .searchParams
                    .get("_v") ||
                ""
            );
        }
        catch(error){
            return "";
        }
    }

    /*
        THE ENGINE VERSION IS CHECKED BEFORE STARTUP.

        localStorage is per ORIGIN, not per app. Several apps served from the
        same host - spinview.app/nanite, /numeris, /raytracer, or one local
        port pointed at a different build folder from one day to the next -
        share this key. Seeding the freeze from it made a page cache-bust
        itself with ANOTHER app's version, and the label then disagreed with
        the number in the log.

        So: ?_v when the page carries one (authoritative, and production puts
        it there with the reload below), otherwise "dev". Cache-busting does
        not suffer: release URLs are stable per version; dev keeps a per-load _t. The real version is
        pushed to the label by spinviewSetDisplayVersion as soon as
        version.txt lands.
    */
    var currentVersion = getPageVersion() || window.__pnBuildVersion || DEFAULT_VERSION;
    function getCurrentVersion(){
        return currentVersion;
    }

    function isDeploymentDev(){
        if(window.__pnDeployTier === "dev") return true;
        if(window.__pnDeployTier === "release") return false;
        return hasDebugParameter() || isLocalDevelopmentHost();
    }

    function updateDebugState(){
        var enabled = isDeploymentDev();

        window.spinviewDebugEnabled = enabled;

        if(typeof window.spinviewSetDebugEnabled === "function"){
            window.spinviewSetDebugEnabled(enabled);
        }

        if(typeof window.spinviewUpdateVersionLabel === "function"){
            window.spinviewUpdateVersionLabel();
        }
    }

    window.getCurrentVersion = getCurrentVersion;
    window.spinviewHasDebugParameter = hasDebugParameter;
    window.spinviewIsLocalDevelopmentHost = isLocalDevelopmentHost;
    window.spinviewDebugEnabled = isDeploymentDev();

    var storedVersion =
        readStorage(localStorage,VERSION_KEY);

    var pageVersion =
        getPageVersion();

    updateDebugState();

    var versionController = typeof AbortController === "function" ? new AbortController() : null;
    var versionTimer = versionController ? setTimeout(function(){ versionController.abort(); }, 8000) : null;
    window.pnVersionReady = fetch(
        VERSION_FILE + "?_=" + Date.now(),
        {
            cache:"no-store",
            signal:versionController ? versionController.signal : undefined
        }
    )
    .then(function(response){
        if(!response.ok){
            throw new Error(
                "HTTP " + response.status
            );
        }

        return response.text();
    })
    .then(function(remoteVersion){
        var lastReloadVersion;
        var url;

        remoteVersion =
            remoteVersion.trim();

        if(!remoteVersion){
            return;
        }
        currentVersion = remoteVersion;

        writeStorage(
            localStorage,
            VERSION_KEY,
            remoteVersion
        );

        /* Label: the shell froze its version before this fetch answered. */
        if(typeof window.spinviewSetDisplayVersion === "function"){
            window.spinviewSetDisplayVersion(remoteVersion);
        }

        updateDebugState();

        if(pageVersion === remoteVersion || (!pageVersion && window.__pnBuildVersion === remoteVersion)){
            return;
        }

        /*
            Local development hosts update the stored version,
            but never force a reload.
        */
        if(isLocalDevelopmentHost()){
            return;
        }

        lastReloadVersion =
            readStorage(
                sessionStorage,
                RELOAD_KEY
            );

        if(lastReloadVersion === remoteVersion){
            return;
        }

        writeStorage(
            sessionStorage,
            RELOAD_KEY,
            remoteVersion
        );

        url = new URL(location.href);

        /*
            Existing parameters such as ?debug are preserved.
        */
        url.searchParams.set(
            "_v",
            remoteVersion
        );

        window.pnVersionReloading = true;
        location.replace(
            url.toString()
        );
    })
    .catch(function(error){
        console.warn(
            "[version] Could not load version.txt.",
            "Using version:",
            storedVersion ||
            pageVersion ||
            DEFAULT_VERSION,
            error
        );

        updateDebugState();
    }).finally(function(){
        if(versionTimer) clearTimeout(versionTimer);
    });
    /* //cld A NEWER VERSION, NOTICED ON RETURN. An installed app (PWA) is often only
       resumed: Android keeps the page alive, so the check above - made once, at load -
       never runs again and the old engine stays in memory. When the page comes back to
       the foreground (at most every two minutes, online, not inside an embed: ChatGPT's
       widget has its own start and restore), version.txt is read again; a different
       version than the one this page froze offers a reload. Never a reload by itself:
       a gesture or a film recording must not be cut. */
    (function(){
        var CHECK_EVERY_MS = 120000;
        var lastCheck = 0;
        var banner = null;

        try{ if(window.top !== window.self) return; }
        catch(error){ return; }

        function running(){
            return window.__spinVerFrozen || "";
        }

        function offer(version){
            if(banner) return;
            banner = document.createElement("div");
            banner.id = "pn-update-banner";
            banner.setAttribute("role","status");
            banner.style.cssText = "position:fixed;top:calc(10px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);z-index:100000;display:flex;gap:10px;align-items:center;padding:8px 10px 8px 14px;border:1px solid #354557;border-radius:10px;background:#101720ee;color:#e8eef7;font:13px/1.4 system-ui,sans-serif;box-shadow:0 4px 18px #0008;white-space:nowrap;max-width:calc(100vw - 24px)";
            var label = document.createElement("span");
            label.textContent = "New version available";
            var reload = document.createElement("button");
            reload.textContent = "Reload";
            reload.style.cssText = "border:0;border-radius:7px;padding:5px 12px;background:#3d7bd8;color:#fff;font:inherit;cursor:pointer";
            reload.onclick = function(){
                var url = new URL(location.href);
                url.searchParams.set("_v", version);
                writeStorage(sessionStorage, RELOAD_KEY, version);
                window.pnVersionReloading = true;
                location.replace(url.toString());
            };
            var close = document.createElement("button");
            close.textContent = "\u00d7";
            close.setAttribute("aria-label","Dismiss");
            close.style.cssText = "border:0;background:none;color:#9fb0c4;font:18px/1 system-ui;cursor:pointer;padding:0 4px";
            close.onclick = function(){ banner.remove(); banner = null; lastCheck = Date.now() + 30 * 60000; };
            banner.appendChild(label);
            banner.appendChild(reload);
            banner.appendChild(close);
            document.body.appendChild(banner);
        }

        function check(){
            var now = Date.now(), mine = running();
            if(banner || document.visibilityState !== "visible") return;
            if(navigator.onLine === false || !mine || mine === DEFAULT_VERSION) return;
            if(now - lastCheck < CHECK_EVERY_MS) return;
            lastCheck = now;
            fetch(VERSION_FILE + "?_=" + now, { cache:"no-store" })
            .then(function(response){ return response.ok ? response.text() : ""; })
            .then(function(remote){
                remote = (remote || "").trim();
                if(remote && remote !== running()) offer(remote);
            })
            .catch(function(){ /* offline or refused: silent, next return tries again */ });
        }

        document.addEventListener("visibilitychange", check);
        window.addEventListener("focus", check);
        window.addEventListener("pageshow", function(event){ if(event.persisted) check(); });
        window.pnCheckVersion = function(){ lastCheck = 0; check(); };
    })();
})();