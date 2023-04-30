# @formbricks/errors

> Error handling for @formbricks packages

## Installation

```bash
npm install @formbricks/errors
```

## Usage

```ts
import { Result, ok, err, okVoid } from "@formbricks/errors";

type CustomError = {
  code: "custom_error";
  message: string;
};

type AnotherCustomError = {
  code: "another_custom_error";
  message: string;
  anotherField: number;
};

type SuccessType = {
  id: string;
};

const test = (): Result<SuccessType, CustomError | AnotherCustomError> => {
  /* There are 4 ways to return a Result from this function */
  // return ok({ id: '123' })
  // return err({ code: 'custom_error', message: 'Custom error message' })
  // return err({ code: 'another_custom_error', message: 'Another custom error message', anotherField: 123 })
  /*
    If SuccessType is void
  */
  // return okVoid()
};

const result = test();

if (result.ok === true) {
  console.log(result.value.id); // you have full type safety here
} else if (result.error.code === "custom_error") {
  console.log(result.error.message); // you have full type safety here
} else if (result.error.code === "another_custom_error") {
  console.log(result.error.anotherField); // you have full type safety here
  console.log(result.error.message);
}
```

## Inspiration

- [Rust Result](https://doc.rust-lang.org/std/result/enum.Result.html)
- [true-myth](https://github.com/true-myth/true-myth)
