/**
 * Workers Training Module Permissions
 * Centralized permission definitions tied to endpoints
 */

export enum WorkersTrainingPermission {
  // Cohort CREATE operations
  CREATE_COHORT = 'workers-training:create-cohort',
  CREATE_TRAINEE = 'workers-training:create-trainee',

  // Cohort READ operations
  VIEW_COHORTS = 'workers-training:view-cohorts',
  VIEW_COHORT_DETAILS = 'workers-training:view-cohort-details',
  VIEW_COHORT_STATS = 'workers-training:view-cohort-stats',
  VIEW_FACILITATOR_COHORTS = 'workers-training:view-facilitator-cohorts',
  VIEW_TRAINEES = 'workers-training:view-trainees',
  VIEW_TRAINEE_DETAILS = 'workers-training:view-trainee-details',
  VIEW_TRAINEE_STATS = 'workers-training:view-trainee-stats',
  VIEW_COHORT_TRAINEES = 'workers-training:view-cohort-trainees',
  VIEW_MEMBER_TRAINING = 'workers-training:view-member-training',

  // Cohort UPDATE operations
  UPDATE_COHORT = 'workers-training:update-cohort',
  UPDATE_COHORT_STATUS = 'workers-training:update-cohort-status',
  UPDATE_TRAINEE = 'workers-training:update-trainee',
  UPDATE_TRAINEE_STATUS = 'workers-training:update-trainee-status',
  ASSIGN_TRAINEE_TO_COHORT = 'workers-training:assign-trainee',
  ASSIGN_TRAINEE_TO_UNIT = 'workers-training:assign-trainee-to-unit',
  RECORD_ATTENDANCE = 'workers-training:record-attendance',
  GRADE_ASSIGNMENT = 'workers-training:grade-assignment',

  // Cohort DELETE operations
  DELETE_COHORT = 'workers-training:delete-cohort',
  DELETE_TRAINEE = 'workers-training:delete-trainee',
}

export const WorkersTrainingPermissionMetadata = {
  [WorkersTrainingPermission.CREATE_COHORT]: {
    path: '/workers-training/cohorts',
    method: 'POST',
    description: 'Create a new cohort',
  },
  [WorkersTrainingPermission.VIEW_COHORTS]: {
    path: '/workers-training/cohorts',
    method: 'GET',
    description: 'View all cohorts',
  },
  [WorkersTrainingPermission.VIEW_COHORT_DETAILS]: {
    path: '/workers-training/cohorts/:id',
    method: 'GET',
    description: 'View specific cohort details',
  },
  [WorkersTrainingPermission.UPDATE_COHORT]: {
    path: '/workers-training/cohorts/:id',
    method: 'PATCH',
    description: 'Update cohort information',
  },
  [WorkersTrainingPermission.DELETE_COHORT]: {
    path: '/workers-training/cohorts/:id',
    method: 'DELETE',
    description: 'Delete a cohort',
  },
  [WorkersTrainingPermission.CREATE_TRAINEE]: {
    path: '/workers-training/trainees',
    method: 'POST',
    description: 'Create a new trainee',
  },
  [WorkersTrainingPermission.VIEW_TRAINEES]: {
    path: '/workers-training/trainees',
    method: 'GET',
    description: 'View all trainees',
  },
  [WorkersTrainingPermission.VIEW_TRAINEE_DETAILS]: {
    path: '/workers-training/trainees/:id',
    method: 'GET',
    description: 'View specific trainee details',
  },
  [WorkersTrainingPermission.UPDATE_TRAINEE]: {
    path: '/workers-training/trainees/:id',
    method: 'PATCH',
    description: 'Update trainee information',
  },
  [WorkersTrainingPermission.DELETE_TRAINEE]: {
    path: '/workers-training/trainees/:id',
    method: 'DELETE',
    description: 'Delete a trainee',
  },
};
