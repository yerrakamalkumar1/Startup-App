(function () {
  "use strict";

  const HOST = (function () {
    try {
      var s = document.currentScript || document.querySelector("script[src*='theme-loader']");
      if (s) return s.src.replace(/\/[^/]*$/, "/");
    } catch (e) {}
    return "/public/";
  })();

  function loadCSS(url) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
  }

  function loadJS(url, defer) {
    var script = document.createElement("script");
    script.src = url;
    if (defer !== false) script.defer = true;
    document.head.appendChild(script);
  }

  var files = [
    { type: "css", path: "css/theme.css" },
    { type: "css", path: "css/components.css" },
    { type: "js", path: "js/theme-system.js" }
  ];

  files.forEach(function (f) {
    var url = (f.path.indexOf("://") > 0) ? f.path : HOST + f.path;
    if (f.type === "css") loadCSS(url);
    else loadJS(url);
  });
})();
