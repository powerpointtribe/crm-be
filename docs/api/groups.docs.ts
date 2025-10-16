export const GroupsDocs = {
  create: {
    operation: { summary: 'Create a new group (district/unit)' },
    responses: [
      { status: 201, description: 'Group created successfully' },
      { status: 400, description: 'Invalid group requirements' },
      { status: 409, description: 'Group already exists' }
    ]
  },
  findAll: {
    operation: { summary: 'Get all groups with filtering' },
    responses: [
      { status: 200, description: 'Groups retrieved successfully' }
    ]
  },
  getGroupStats: {
    operation: { summary: 'Get group statistics' },
    responses: [
      { status: 200, description: 'Group stats retrieved successfully' }
    ]
  },
  getDistricts: {
    operation: { summary: 'Get all districts' },
    responses: [
      { status: 200, description: 'Districts retrieved successfully' }
    ]
  },
  getUnits: {
    operation: { summary: 'Get all units' },
    responses: [
      { status: 200, description: 'Units retrieved successfully' }
    ]
  },
  getDistrictsNeedingPastors: {
    operation: { summary: 'Get districts that need pastors' },
    responses: [
      { status: 200, description: 'Districts needing pastors retrieved successfully' }
    ]
  },
  getUnitsNeedingHeads: {
    operation: { summary: 'Get units that need heads' },
    responses: [
      { status: 200, description: 'Units needing heads retrieved successfully' }
    ]
  },
  getMyGroups: {
    operation: { summary: 'Get groups led by current user' },
    responses: [
      { status: 200, description: 'User groups retrieved successfully' }
    ]
  },
  findOne: {
    operation: { summary: 'Get group by ID' },
    param: { name: 'id', description: 'Group ID' },
    responses: [
      { status: 200, description: 'Group retrieved successfully' },
      { status: 404, description: 'Group not found' }
    ]
  },
  update: {
    operation: { summary: 'Update group' },
    param: { name: 'id', description: 'Group ID' },
    responses: [
      { status: 200, description: 'Group updated successfully' },
      { status: 404, description: 'Group not found' }
    ]
  },
  addMember: {
    operation: { summary: 'Add member to group' },
    params: [
      { name: 'id', description: 'Group ID' },
      { name: 'memberId', description: 'Member ID' }
    ],
    responses: [
      { status: 200, description: 'Member added to group successfully' }
    ]
  },
  removeMember: {
    operation: { summary: 'Remove member from group' },
    params: [
      { name: 'id', description: 'Group ID' },
      { name: 'memberId', description: 'Member ID' }
    ],
    responses: [
      { status: 200, description: 'Member removed from group successfully' }
    ]
  },
  assignDistrictPastor: {
    operation: { summary: 'Assign district pastor to district' },
    params: [
      { name: 'id', description: 'District ID' },
      { name: 'pastorId', description: 'Pastor Member ID' }
    ],
    responses: [
      { status: 200, description: 'District pastor assigned successfully' }
    ]
  },
  assignUnitHead: {
    operation: { summary: 'Assign unit head to unit' },
    params: [
      { name: 'id', description: 'Unit ID' },
      { name: 'headId', description: 'Unit Head Member ID' }
    ],
    responses: [
      { status: 200, description: 'Unit head assigned successfully' }
    ]
  },
  addChamp: {
    operation: { summary: 'Add champ to district' },
    params: [
      { name: 'id', description: 'District ID' },
      { name: 'champId', description: 'Champ Member ID' }
    ],
    responses: [
      { status: 200, description: 'Champ added successfully' }
    ]
  },
  removeChamp: {
    operation: { summary: 'Remove champ from district' },
    params: [
      { name: 'id', description: 'District ID' },
      { name: 'champId', description: 'Champ Member ID' }
    ],
    responses: [
      { status: 200, description: 'Champ removed successfully' }
    ]
  },
  updateHosting: {
    operation: { summary: 'Update hosting information for district' },
    param: { name: 'id', description: 'District ID' },
    responses: [
      { status: 200, description: 'Hosting information updated successfully' }
    ]
  },
  rotateHost: {
    operation: { summary: 'Rotate to next host for district' },
    param: { name: 'id', description: 'District ID' },
    responses: [
      { status: 200, description: 'Host rotated successfully' }
    ]
  },
  deactivate: {
    operation: { summary: 'Deactivate group' },
    param: { name: 'id', description: 'Group ID' },
    responses: [
      { status: 200, description: 'Group deactivated successfully' }
    ]
  },
  activate: {
    operation: { summary: 'Activate group' },
    param: { name: 'id', description: 'Group ID' },
    responses: [
      { status: 200, description: 'Group activated successfully' }
    ]
  },
  remove: {
    operation: { summary: 'Delete group (super admin only)' },
    param: { name: 'id', description: 'Group ID' },
    responses: [
      { status: 204, description: 'Group deleted successfully' },
      { status: 404, description: 'Group not found' }
    ]
  }
};