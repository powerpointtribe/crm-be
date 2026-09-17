export enum GisPermission {
  VIEW_DASHBOARD = 'gis:view-dashboard',
  VIEW_DISTRICT = 'gis:view-district',
  VIEW_DIRECTORATE = 'gis:view-directorate',
  VIEW_UNIT = 'gis:view-unit',
  VIEW_MEMBER_JOURNEY = 'gis:view-member-journey',
  VIEW_TRENDS = 'gis:view-trends',
}

export const GisPermissionMetadata = {
  [GisPermission.VIEW_DASHBOARD]: {
    path: '/gis/dashboard',
    method: 'GET',
    description: 'View pastor-level GIS dashboard',
  },
  [GisPermission.VIEW_DISTRICT]: {
    path: '/gis/district/:id',
    method: 'GET',
    description: 'View district-level GIS metrics',
  },
  [GisPermission.VIEW_DIRECTORATE]: {
    path: '/gis/directorate/:id',
    method: 'GET',
    description: 'View directorate-level GIS metrics',
  },
  [GisPermission.VIEW_UNIT]: {
    path: '/gis/unit/:id',
    method: 'GET',
    description: 'View unit-level GIS metrics',
  },
  [GisPermission.VIEW_MEMBER_JOURNEY]: {
    path: '/gis/member/:id/journey',
    method: 'GET',
    description: 'View individual member funnel journey',
  },
  [GisPermission.VIEW_TRENDS]: {
    path: '/gis/trends',
    method: 'GET',
    description: 'View GIS trend data over time',
  },
};
