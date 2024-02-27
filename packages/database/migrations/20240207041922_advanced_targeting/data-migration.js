"use strict";
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __generator =
  (this && this.__generator) ||
  function (thisArg, body) {
    var _ = {
        label: 0,
        sent: function () {
          if (t[0] & 1) throw t[1];
          return t[1];
        },
        trys: [],
        ops: [],
      },
      f,
      y,
      t,
      g;
    return (
      (g = { next: verb(0), throw: verb(1), return: verb(2) }),
      typeof Symbol === "function" &&
        (g[Symbol.iterator] = function () {
          return this;
        }),
      g
    );
    function verb(n) {
      return function (v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError("Generator is already executing.");
      while ((g && ((g = 0), op[0] && (_ = 0)), _))
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y["return"]
                  : op[0]
                    ? y["throw"] || ((t = y["return"]) && t.call(y), 0)
                    : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!((t = _.trys), (t = t.length > 0 && t[t.length - 1])) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
Object.defineProperty(exports, "__esModule", { value: true });
var cuid2_1 = require("@paralleldrive/cuid2");
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
function main() {
  return __awaiter(this, void 0, void 0, function () {
    var _this = this;
    return __generator(this, function (_a) {
      switch (_a.label) {
        case 0:
          return [
            4 /*yield*/,
            prisma.$transaction(function (tx) {
              return __awaiter(_this, void 0, void 0, function () {
                var allSurveysWithAttributeFilters;
                var _this = this;
                return __generator(this, function (_a) {
                  switch (_a.label) {
                    case 0:
                      return [
                        4 /*yield*/,
                        prisma.survey.findMany({
                          where: {
                            attributeFilters: {
                              some: {},
                            },
                          },
                          include: {
                            attributeFilters: { include: { attributeClass: true } },
                          },
                        }),
                      ];
                    case 1:
                      allSurveysWithAttributeFilters = _a.sent();
                      if (
                        !(allSurveysWithAttributeFilters === null || allSurveysWithAttributeFilters === void 0
                          ? void 0
                          : allSurveysWithAttributeFilters.length)
                      ) {
                        // stop the migration if there are no surveys with attribute filters
                        return [2 /*return*/];
                      }
                      allSurveysWithAttributeFilters.forEach(function (survey) {
                        return __awaiter(_this, void 0, void 0, function () {
                          var attributeFilters, filters;
                          return __generator(this, function (_a) {
                            switch (_a.label) {
                              case 0:
                                attributeFilters = survey.attributeFilters;
                                // if there are no attribute filters, we can skip this survey
                                if (
                                  !(attributeFilters === null || attributeFilters === void 0
                                    ? void 0
                                    : attributeFilters.length)
                                ) {
                                  return [2 /*return*/];
                                }
                                filters = attributeFilters.map(function (filter, idx) {
                                  var attributeClass = filter.attributeClass;
                                  var resource;
                                  // if the attribute class is userId, we need to create a user segment with the person filter
                                  if (
                                    attributeClass.name === "userId" &&
                                    attributeClass.type === "automatic"
                                  ) {
                                    resource = {
                                      id: (0, cuid2_1.createId)(),
                                      root: {
                                        type: "person",
                                        personIdentifier: "userId",
                                      },
                                      qualifier: {
                                        operator: filter.condition,
                                      },
                                      value: filter.value,
                                    };
                                  } else {
                                    resource = {
                                      id: (0, cuid2_1.createId)(),
                                      root: {
                                        type: "attribute",
                                        attributeClassName: attributeClass.name,
                                      },
                                      qualifier: {
                                        operator: filter.condition,
                                      },
                                      value: filter.value,
                                    };
                                  }
                                  var attributeSegment = {
                                    id: filter.id,
                                    connector: idx === 0 ? null : "and",
                                    resource: resource,
                                  };
                                  return attributeSegment;
                                });
                                return [
                                  4 /*yield*/,
                                  tx.segment.create({
                                    data: {
                                      title: "".concat(survey.id),
                                      description: "",
                                      isPrivate: true,
                                      filters: filters,
                                      surveys: {
                                        connect: {
                                          id: survey.id,
                                        },
                                      },
                                      environment: {
                                        connect: {
                                          id: survey.environmentId,
                                        },
                                      },
                                    },
                                  }),
                                ];
                              case 1:
                                _a.sent();
                                return [2 /*return*/];
                            }
                          });
                        });
                      });
                      // delete all attribute filters
                      return [4 /*yield*/, tx.surveyAttributeFilter.deleteMany({})];
                    case 2:
                      // delete all attribute filters
                      _a.sent();
                      return [2 /*return*/];
                  }
                });
              });
            }),
          ];
        case 1:
          _a.sent();
          return [2 /*return*/];
      }
    });
  });
}
main()
  .catch(function (e) {
    return __awaiter(void 0, void 0, void 0, function () {
      return __generator(this, function (_a) {
        console.error(e);
        process.exit(1);
        return [2 /*return*/];
      });
    });
  })
  .finally(function () {
    return __awaiter(void 0, void 0, void 0, function () {
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            return [4 /*yield*/, prisma.$disconnect()];
          case 1:
            return [2 /*return*/, _a.sent()];
        }
      });
    });
  });
