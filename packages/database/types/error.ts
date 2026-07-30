// Member names follow Prisma's documented error-code semantics. Note the two
// not-found codes are easy to swap: P2015 is the *related* record (a nested/
// connected record could not be found), while P2025 is the record the operation
// itself targets (the common "row to update/delete not found" case).
export enum PrismaErrorType {
  UniqueConstraintViolation = "P2002",
  ForeignKeyConstraintViolation = "P2003",
  RelatedRecordNotFound = "P2015",
  RecordNotFound = "P2025",
}
