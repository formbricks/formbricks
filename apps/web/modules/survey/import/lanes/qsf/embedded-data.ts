// The naming rule lives in the resolver so every lane shares it (ENG-3013); the QSF mapper only needs
// the function under its historical name.
export {
  type TFieldNameMapping as TEmbeddedDataFieldMapping,
  normalizeFieldName as mapEmbeddedDataFieldName,
} from "../../resolve/embedded-data";
