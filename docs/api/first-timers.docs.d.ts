export declare const FirstTimersDocs: {
    createPublic: {
        operation: {
            summary: string;
        };
        tags: string[];
        responses: {
            status: number;
            description: string;
        }[];
    };
    create: {
        operation: {
            summary: string;
        };
        responses: {
            status: number;
            description: string;
        }[];
    };
    findAll: {
        operation: {
            summary: string;
        };
        responses: {
            status: number;
            description: string;
        }[];
    };
    getFirstTimerStats: {
        operation: {
            summary: string;
        };
        responses: {
            status: number;
            description: string;
        }[];
    };
    getNeedingFollowUp: {
        operation: {
            summary: string;
        };
        responses: {
            status: number;
            description: string;
        }[];
    };
    getRecentVisitors: {
        operation: {
            summary: string;
        };
        query: {
            name: string;
            required: boolean;
            description: string;
        };
        responses: {
            status: number;
            description: string;
        }[];
    };
    getMyAssignments: {
        operation: {
            summary: string;
        };
        responses: {
            status: number;
            description: string;
        }[];
    };
    findOne: {
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
    addFollowUp: {
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
    updateStatus: {
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
    assignToMember: {
        operation: {
            summary: string;
        };
        params: {
            name: string;
            description: string;
        }[];
        responses: {
            status: number;
            description: string;
        }[];
    };
    convertToMember: {
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
    assignFollowUp: {
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
    getPendingDistrictAssignments: {
        operation: {
            summary: string;
        };
        responses: {
            status: number;
            description: string;
        }[];
    };
    updateNotes: {
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
    deactivate: {
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
    remove: {
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
    bulkAssign: {
        operation: {
            summary: string;
        };
        responses: {
            status: number;
            description: string;
        }[];
    };
    bulkUpdateStatus: {
        operation: {
            summary: string;
        };
        responses: {
            status: number;
            description: string;
        }[];
    };
    bulkUpload: {
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
                    skipErrors: {
                        type: string;
                        description: string;
                        default: boolean;
                    };
                    defaultAssignedTo: {
                        type: string;
                        description: string;
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
    getSampleCSV: {
        operation: {
            summary: string;
        };
        responses: {
            status: number;
            description: string;
        }[];
    };
};
