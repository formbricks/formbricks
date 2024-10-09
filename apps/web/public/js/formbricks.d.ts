import { z } from 'zod';

declare interface ApiConfig {
    environmentId: string;
    apiHost: string;
}

declare class AttributeAPI {
    private apiHost;
    private environmentId;
    constructor(apiHost: string, environmentId: string);
    update(attributeUpdateInput: Omit<TAttributeUpdateInput, "environmentId">): Promise<Result<{
        changed: boolean;
        message: string;
    }, NetworkError | Error>>;
}

declare class Client {
    response: ResponseAPI;
    display: DisplayAPI;
    people: PeopleAPI;
    storage: StorageAPI;
    attribute: AttributeAPI;
    constructor(options: ApiConfig);
}

declare class DisplayAPI {
    private apiHost;
    private environmentId;
    constructor(baseUrl: string, environmentId: string);
    create(displayInput: Omit<TDisplayCreateInput, "environmentId">): Promise<Result<{
        id: string;
    }, NetworkError | Error>>;
}

declare const formbricks: {
    init: (initConfig: TJsConfigInput) => Promise<void>;
    setEmail: (email: string) => Promise<void>;
    setAttribute: (key: string, value: any) => Promise<void>;
    track: (name: string, properties?: TJsTrackProperties) => Promise<void>;
    logout: () => Promise<void>;
    reset: () => Promise<void>;
    registerRouteChange: () => Promise<void>;
    getApi: () => FormbricksAPI;
};

declare class FormbricksAPI {
    client: Client;
    constructor(options: ApiConfig);
}

declare const formbricksApp: TFormbricksApp;
export default formbricksApp;

declare interface NetworkError {
    code: "network_error";
    message: string;
    status: number;
    url: URL;
}

declare class PeopleAPI {
    private apiHost;
    private environmentId;
    constructor(apiHost: string, environmentId: string);
    create(userId: string): Promise<Result<{
        userId: string;
    }, NetworkError | Error>>;
}

declare class ResponseAPI {
    private apiHost;
    private environmentId;
    constructor(apiHost: string, environmentId: string);
    create(responseInput: Omit<TResponseInput, "environmentId">): Promise<Result<{
        id: string;
    }, NetworkError | Error>>;
    update({ responseId, finished, data, ttc, variables, language, }: TResponseUpdateInputWithResponseId): Promise<Result<object, NetworkError | Error>>;
}

declare type Result<T, E = Error> = { ok: true; data: T } | { ok: false; error: E };

declare class StorageAPI {
    private apiHost;
    private environmentId;
    constructor(apiHost: string, environmentId: string);
    uploadFile(file: {
        type: string;
        name: string;
        base64: string;
    }, { allowedFileExtensions, surveyId }?: TUploadFileConfig | undefined): Promise<string>;
}

declare type TAttributeUpdateInput = z.infer<typeof ZAttributeUpdateInput>;

declare type TDisplayCreateInput = z.infer<typeof ZDisplayCreateInput>;

declare type TFormbricksApp = typeof formbricks;

declare type TJsConfigInput = z.infer<typeof ZJsConfigInput>;

declare type TJsTrackProperties = z.infer<typeof ZJsTrackProperties>;

declare type TResponseInput = z.infer<typeof ZResponseInput>;

declare type TResponseUpdateInput = z.infer<typeof ZResponseUpdateInput>;

declare type TResponseUpdateInputWithResponseId = TResponseUpdateInput & {
    responseId: string;
};

declare type TUploadFileConfig = z.infer<typeof ZUploadFileConfig>;

declare const ZAttributeUpdateInput = z.object({
    environmentId: z.string().cuid2(),
    userId: z.string(),
    attributes: z.record(z.union([z.string(), z.number()])),
});

declare const ZDisplayCreateInput = z.object({
    environmentId: z.string().cuid2(),
    surveyId: z.string().cuid2(),
    userId: z.string().optional(),
    responseId: z.string().cuid2().optional(),
});

declare const ZJsConfigInput = z.object({
    environmentId: z.string().cuid2(),
    apiHost: z.string(),
    errorHandler: z.function().args(z.any()).returns(z.void()).optional(),
    userId: z.string().optional(),
    attributes: z.record(z.string()).optional(),
});

declare const ZJsTrackProperties = z.object({
    hiddenFields: ZResponseHiddenFieldValue.optional(),
});

declare const ZResponseInput = z.object({
    createdAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
    environmentId: z.string().cuid2(),
    surveyId: z.string().cuid2(),
    userId: z.string().nullish(),
    displayId: z.string().nullish(),
    singleUseId: z.string().nullable().optional(),
    finished: z.boolean(),
    language: z.string().optional(),
    data: ZResponseData,
    variables: ZResponseVariables.optional(),
    ttc: ZResponseTtc.optional(),
    meta: z
    .object({
        source: z.string().optional(),
        url: z.string().optional(),
        userAgent: z
        .object({
            browser: z.string().optional(),
            device: z.string().optional(),
            os: z.string().optional(),
        })
        .optional(),
        country: z.string().optional(),
        action: z.string().optional(),
    })
    .optional(),
});

declare const ZResponseUpdateInput = z.object({
    finished: z.boolean(),
    data: ZResponseData,
    variables: ZResponseVariables.optional(),
    ttc: ZResponseTtc.optional(),
    language: z.string().optional(),
});

declare const ZUploadFileConfig = z.object({
    allowedFileExtensions: z.array(z.string()).optional(),
    surveyId: z.string().optional(),
});

export { }


declare global {
    interface Window {
        formbricks: TFormbricksApp | undefined;
    }
}

