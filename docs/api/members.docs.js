"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MembersDocs = void 0;
exports.MembersDocs = {
    create: {
        operation: { summary: 'Create a new member' }
    },
    findAll: {
        operation: { summary: 'Get all members with advanced filtering' }
    },
    getMemberStats: {
        operation: { summary: 'Get comprehensive member statistics' }
    },
    getDistrictMembers: {
        operation: { summary: 'Get all members in a specific district' },
        param: { name: 'districtId', description: 'District ID' }
    },
    getMyDistrictMembers: {
        operation: { summary: "Get members in current user's district" }
    },
    getUnitMembers: {
        operation: { summary: 'Get all members in a specific unit' },
        param: { name: 'unitId', description: 'Unit ID' }
    },
    getMyUnitMembers: {
        operation: { summary: "Get members in current user's unit" }
    },
    findOne: {
        operation: { summary: 'Get member by ID' },
        param: { name: 'id', description: 'Member ID' }
    },
    update: {
        operation: { summary: 'Update member' },
        param: { name: 'id', description: 'Member ID' }
    },
    remove: {
        operation: { summary: 'Delete member (super admin only)' },
        param: { name: 'id', description: 'Member ID' }
    },
    bulkOperation: {
        operation: { summary: 'Queue bulk create or update members from CSV file' },
        consumes: 'multipart/form-data',
        body: {
            description: 'CSV file with member data and operation parameters',
            schema: {
                type: 'object',
                properties: {
                    file: { type: 'string', format: 'binary' },
                    operationType: {
                        type: 'string',
                        description: 'Type of operation to perform'
                    },
                    skipErrors: {
                        type: 'boolean',
                        description: 'Whether to skip validation errors and continue with valid records',
                        default: false
                    },
                    identifierField: {
                        type: 'string',
                        description: 'Field to use as identifier for update operations',
                        default: 'email'
                    },
                    defaultDistrict: {
                        type: 'string',
                        description: 'Default district assignment for all members'
                    },
                    defaultUnit: {
                        type: 'string',
                        description: 'Default unit assignment for all members'
                    },
                    dryRun: {
                        type: 'boolean',
                        description: 'Preview changes without applying them',
                        default: false
                    }
                }
            }
        },
        responses: [
            {
                status: 202,
                description: 'Bulk operation job queued successfully',
                schema: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                jobId: { type: 'string' },
                                status: { type: 'string' }
                            }
                        },
                        message: { type: 'string' }
                    }
                }
            },
            { status: 400, description: 'Invalid file format or content' }
        ]
    },
    getMemberCSVTemplate: {
        operation: { summary: 'Download CSV template for bulk operations' },
        param: {
            name: 'operationType',
            description: 'Type of operation template to download'
        },
        responses: [
            { status: 200, description: 'CSV template downloaded successfully' }
        ]
    }
};
//# sourceMappingURL=members.docs.js.map