export declare const DashboardDocs: {
    getAccessibleModules: {
        operation: {
            summary: string;
        };
    };
    getDashboardOverview: {
        operation: {
            summary: string;
        };
        responses: {
            status: number;
            description: string;
        }[];
    };
    getFirstTimers: {
        operation: {
            summary: string;
        };
    };
    getMembers: {
        operation: {
            summary: string;
        };
    };
    getFinances: {
        operation: {
            summary: string;
        };
    };
    getSystemSettings: {
        operation: {
            summary: string;
        };
    };
    getDetailedStats: {
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
    getActivityFeed: {
        operation: {
            summary: string;
        };
        query: {
            name: string;
            required: boolean;
            type: string;
            description: string;
        };
        responses: {
            status: number;
            description: string;
        }[];
    };
    getPendingTasks: {
        operation: {
            summary: string;
        };
        responses: {
            status: number;
            description: string;
        }[];
    };
    getQuickStats: {
        operation: {
            summary: string;
        };
        responses: {
            status: number;
            description: string;
        }[];
    };
    getGrowthAnalytics: {
        operation: {
            summary: string;
            description: string;
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
    getRecentActivity: {
        operation: {
            summary: string;
            description: string;
        };
        queries: {
            name: string;
            required: boolean;
            type: string;
            description: string;
        }[];
        responses: {
            status: number;
            description: string;
        }[];
    };
    getDemographics: {
        operation: {
            summary: string;
            description: string;
        };
        responses: {
            status: number;
            description: string;
        }[];
    };
};
