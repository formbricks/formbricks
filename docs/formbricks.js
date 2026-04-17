!function () {
  var appUrl = "https://app.formbricks.com"; // use PUBLIC_URL if you are using multi-domain setup, otherwise use WEBAPP_URL
  var environmentId = "clgwcwp4z000lpf0hur7pzbuv";

  var t = document.createElement("script");
  t.type = "text/javascript";
  t.async = !0;
  t.src = appUrl + "/js/formbricks.umd.cjs";

  var e = document.getElementsByTagName("script")[0];
  e.parentNode.insertBefore(t, e);

  setTimeout(function () {
    window.formbricks.setup({ environmentId: environmentId, appUrl: appUrl });
  }, 500);
}();