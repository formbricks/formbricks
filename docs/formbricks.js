!(function () {
  var appUrl = "https://app.formbricks.com"; // use PUBLIC_URL if you are using multi-domain setup, otherwise use WEBAPP_URL
  var workspaceId = "clgwcwp4z000lpf0hur7pzbuv";

  var t = document.createElement("script");
  t.type = "text/javascript";
  t.async = !0;
  t.src = appUrl + "/js/formbricks.umd.cjs";
  t.onload = function () {
    window.formbricks.setup({ workspaceId: workspaceId, appUrl: appUrl });
  };

  var e = document.getElementsByTagName("script")[0];
  e.parentNode.insertBefore(t, e);
})();
