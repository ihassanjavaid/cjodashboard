// Role → allowed tab IDs. Assign roles in Firebase Console → Firestore →
// `roles` collection → doc ID = the user's login email (their real email
// address, matching what was used to create their Firebase Auth account) →
// field `role` = one of the keys below.
//
// Tab IDs match new-ui/NewUI.jsx's TABS: design, std, process, social,
// stdtracker, strategy.

export const ROLES = {
  management: 'Management',
  design: 'Design & Usability',
  process: 'Process Innovation',
  std: 'Product Optimization',
};

// Management sees everything, incl. tabs still marked "Coming soon".
// Every other role sees its own tab plus the shared/misc tabs.
export const ROLE_TABS = {
  management: ['design', 'std', 'process', 'social', 'stdtracker', 'strategy'],
  design: ['design', 'social', 'stdtracker'],
  process: ['process', 'social', 'stdtracker'],
  std: ['std', 'social', 'stdtracker'],
};

export function tabsForRole(role) {
  return ROLE_TABS[role] || [];
}

// Each role's own "home" tab — used to pick the default active tab on login.
export const ROLE_HOME_TAB = {
  management: 'design',
  design: 'design',
  process: 'process',
  std: 'std',
};
