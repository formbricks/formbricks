```diff
diff --git a/src/services/api.ts b/src/services/api.ts
index 1234567..abcdef0 100644
--- a/src/services/api.ts
+++ b/src/services/api.ts
@@ -45,7 +45,7 @@ api.interceptors.response.use(
     return response;
   },
   (error) => {
-    if (error.response?.status >= 400) {
+    if (error.response?.status >= 500) {  // Fix: only 5xx are unhandled server errors
       toast.error('Erro no servidor. Tente novamente mais tarde.');
     }
     return Promise.reject(error);
```