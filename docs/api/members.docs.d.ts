export declare const MembersDocs: {
    create: {
        operation: {
            summary: string;
        };
    };
    findAll: {
        operation: {
            summary: string;
        };
    };
    getMemberStats: {
        operation: {
            summary: string;
        };
    };
    getDistrictMembers: {
        operation: {
            summary: string;
        };
        param: {
            name: string;
            description: string;
        };
    };
    getMyDistrictMembers: {
        operation: {
            summary: string;
        };
    };
    getUnitMembers: {
        operation: {
            summary: string;
        };
        param: {
            name: string;
            description: string;
        };
    };
    getMyUnitMembers: {
        operation: {
            summary: string;
        };
    };
    findOne: {
        operation: {
            summary: string;
        };
        param: {
            name: string;
            description: string;
        };
    };
    update: {
        operation: {
            summary: string;
        };
        param: {
            name: string;
            description: string;
        };
    };
    remove: {
        operation: {
            summary: string;
        };
        param: {
            name: string;
            description: string;
        };
    };
    bulkOperation: {
        operation: {
            summary: string;
        };
        consumes: string;
        body: {
            description: string;
            schema: {
                type: string;
                properties: {
                    file: {
                        type: string;
                        format: string;
                    };
                    operationType: {
                        type: string;
                        description: string;
                    };
                    skipErrors: {
                        type: string;
                        description: string;
                        default: boolean;
                    };
                    identifierField: {
                        type: string;
                        description: string;
                        default: string;
                    };
                    defaultDistrict: {
                        type: string;
                        description: string;
                    };
                    defaultUnit: {
                        type: string;
                        description: string;
                    };
                    dryRun: {
                        type: string;
                        description: string;
                        default: boolean;
                    };
                };
            };
        };
        responses: ({
            status: number;
            description: string;
            schema: {
                type: string;
                properties: {
                    success: {
                        type: string;
                    };
                    data: {
                        type: string;
                        properties: {
                            jobId: {
                                type: string;
                            };
                            status: {
                                type: string;
                            };
                        };
                    };
                    message: {
                        type: string;
                    };
                };
            };
        } | {
            status: number;
            description: string;
            schema?: undefined;
        })[];
    };
    getMemberCSVTemplate: {
        operation: {
            summary: string;
        };
        param: {
            name: string;
            description: string;
        };
        responses: {
            status: number;
            description: string;
        }[];
    };
};
