/**
 * EMBEDX Authentication & Role-Based Access Control (RBAC)
 * Verifies Google Workspace Session Identity & Domain Authority
 */

/**
 * Normalizes an email address
 */
function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Checks if email ends with the verified institutional domain
 */
function isInstitutionalEmail_(email) {
  const norm = normalizeEmail_(email);
  return norm.endsWith(CONFIG.INSTITUTION.EMAIL_DOMAIN.toLowerCase());
}

/**
 * Retrieves the currently authenticated user session details
 */
function getCurrentUser_() {
  let email = '';
  try {
    email = Session.getActiveUser().getEmail();
  } catch (e) {
    email = '';
  }

  // Fallback for developmental / mock environments
  if (!email) {
    const devEmail = getAppProperty('DEV_MOCK_USER_EMAIL');
    if (devEmail) {
      email = devEmail;
    }
  }

  const normEmail = normalizeEmail_(email);
  const isDomainAuth = isInstitutionalEmail_(normEmail);
  const isSuper = (normEmail === normalizeEmail_(CONFIG.SUPER_ADMIN.EMAIL));

  let role = isSuper ? CONFIG.ROLES.SUPER_ADMIN : CONFIG.ROLES.STUDENT;

  // Check additional admins configured in ScriptProperties or USERS sheet
  if (!isSuper) {
    const adminCsv = getAppProperty('ADMIN_EMAILS', '');
    const adminList = adminCsv.split(',').map(normalizeEmail_).filter(Boolean);
    if (adminList.includes(normEmail)) {
      role = CONFIG.ROLES.ADMIN;
    } else {
      // Check role in USERS table if spreadsheet is available
      try {
        const userRec = findUserByEmail_(normEmail);
        if (userRec && [CONFIG.ROLES.ADMIN, CONFIG.ROLES.COORDINATOR, CONFIG.ROLES.HOD, CONFIG.ROLES.SUPER_ADMIN].includes(userRec.role)) {
          role = userRec.role;
        }
      } catch (err) {
        // Table not initialized yet
      }
    }
  }

  const isAdmin = (role === CONFIG.ROLES.SUPER_ADMIN || role === CONFIG.ROLES.ADMIN || role === CONFIG.ROLES.COORDINATOR || role === CONFIG.ROLES.HOD);

  return {
    email: normEmail,
    displayEmail: email,
    domainAuthorized: isDomainAuth,
    role: role,
    isSuperAdmin: isSuper,
    isAdmin: isAdmin,
    isStudent: !isAdmin
  };
}

/**
 * Guard: Enforces valid institutional authentication
 */
function requireAuthenticatedUser_() {
  const user = getCurrentUser_();
  if (!user.email) {
    throw new Error('AUTH_REQUIRED: You must be logged in with your SRM TRP Google Workspace account.');
  }
  if (!user.domainAuthorized && !user.isSuperAdmin) {
    throw new Error('ACCESS_DENIED: Only verified accounts ending with ' + CONFIG.INSTITUTION.EMAIL_DOMAIN + ' are authorized to access this platform. (Current: ' + user.email + ')');
  }
  return user;
}

/**
 * Guard: Enforces Administrator or Coordinator or HOD privileges
 */
function requireAdmin_() {
  const user = requireAuthenticatedUser_();
  if (!user.isAdmin) {
    throw new Error('FORBIDDEN: Administrative privileges required. Contact Super Admin ' + CONFIG.SUPER_ADMIN.EMAIL + ' for access.');
  }
  return user;
}

/**
 * Guard: Enforces Super Administrator privileges exclusively
 */
function requireSuperAdmin_() {
  const user = requireAuthenticatedUser_();
  if (!user.isSuperAdmin) {
    throw new Error('FORBIDDEN: Super Admin privileges required (' + CONFIG.SUPER_ADMIN.EMAIL + ').');
  }
  return user;
}

/**
 * Helper to find user in USERS sheet
 */
function findUserByEmail_(email) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.USERS);
    if (!sheet) return null;
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return null;

    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const emailIdx = headers.indexOf('email');
    if (emailIdx === -1) return null;

    const normTarget = normalizeEmail_(email);
    for (let i = 1; i < data.length; i++) {
      if (normalizeEmail_(data[i][emailIdx]) === normTarget) {
        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = data[i][idx];
        });
        obj._rowIndex = i + 1;
        return obj;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Super Admin function to assign an admin/coordinator/hod role to a user
 */
function assignAdminRole(email, role, displayName, department) {
  const superUser = requireSuperAdmin_();
  const targetEmail = normalizeEmail_(email);
  if (!isInstitutionalEmail_(targetEmail) && targetEmail !== normalizeEmail_(CONFIG.SUPER_ADMIN.EMAIL)) {
    throw new Error('Email must belong to ' + CONFIG.INSTITUTION.EMAIL_DOMAIN);
  }

  const allowedRoles = [CONFIG.ROLES.SUPER_ADMIN, CONFIG.ROLES.ADMIN, CONFIG.ROLES.COORDINATOR, CONFIG.ROLES.HOD, CONFIG.ROLES.STUDENT];
  if (!allowedRoles.includes(role)) {
    throw new Error('Invalid role specified: ' + role);
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim().toLowerCase());
  const emailIdx = headers.indexOf('email');
  const roleIdx = headers.indexOf('role');
  const nameIdx = headers.indexOf('display_name');
  const deptIdx = headers.indexOf('department');

  let updated = false;
  for (let i = 1; i < data.length; i++) {
    if (normalizeEmail_(data[i][emailIdx]) === targetEmail) {
      if (roleIdx !== -1) sheet.getRange(i + 1, roleIdx + 1).setValue(role);
      if (nameIdx !== -1 && displayName) sheet.getRange(i + 1, nameIdx + 1).setValue(displayName);
      if (deptIdx !== -1 && department) sheet.getRange(i + 1, deptIdx + 1).setValue(department);
      updated = true;
      break;
    }
  }

  if (!updated) {
    // Insert new user record
    const newId = 'USR-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    const now = new Date();
    sheet.appendRow([
      newId,
      targetEmail,
      displayName || targetEmail.split('@')[0],
      role,
      department || 'EEE',
      'Faculty / Leadership',
      now,
      now,
      'active'
    ]);
  }

  // Update ScriptProperties ADMIN_EMAILS cache
  const adminCsv = getAppProperty('ADMIN_EMAILS', '');
  const adminSet = new Set(adminCsv.split(',').map(normalizeEmail_).filter(Boolean));
  if ([CONFIG.ROLES.ADMIN, CONFIG.ROLES.COORDINATOR, CONFIG.ROLES.HOD, CONFIG.ROLES.SUPER_ADMIN].includes(role)) {
    adminSet.add(targetEmail);
  } else {
    adminSet.delete(targetEmail);
  }
  setAppProperty('ADMIN_EMAILS', Array.from(adminSet).join(','));

  // Log action
  logAuditAction_(superUser.email, 'ASSIGN_ROLE', 'USER', targetEmail, 'Assigned role: ' + role + ' (' + displayName + ')');

  return { success: true, message: 'Successfully updated role for ' + targetEmail + ' to ' + role };
}

/**
 * Super Admin function to list all configured administrators and team leaders
 */
function getAdminUsersList() {
  requireAdmin_();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.USERS);
  const data = sheet.getDataRange().getValues();
  const results = [];

  if (data.length > 1) {
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const emailIdx = headers.indexOf('email');
    const roleIdx = headers.indexOf('role');
    const nameIdx = headers.indexOf('display_name');
    const deptIdx = headers.indexOf('department');
    const statusIdx = headers.indexOf('status');

    for (let i = 1; i < data.length; i++) {
      const userRole = data[i][roleIdx];
      if ([CONFIG.ROLES.SUPER_ADMIN, CONFIG.ROLES.ADMIN, CONFIG.ROLES.COORDINATOR, CONFIG.ROLES.HOD].includes(userRole)) {
        results.push({
          email: data[i][emailIdx],
          name: data[i][nameIdx],
          role: userRole,
          department: data[i][deptIdx],
          status: data[i][statusIdx] || 'active',
          isSuperAdmin: (normalizeEmail_(data[i][emailIdx]) === normalizeEmail_(CONFIG.SUPER_ADMIN.EMAIL))
        });
      }
    }
  }

  // Ensure Super Admin is always present in list
  const hasSuper = results.some(r => normalizeEmail_(r.email) === normalizeEmail_(CONFIG.SUPER_ADMIN.EMAIL));
  if (!hasSuper) {
    results.unshift({
      email: CONFIG.SUPER_ADMIN.EMAIL,
      name: CONFIG.SUPER_ADMIN.NAME,
      role: CONFIG.ROLES.SUPER_ADMIN,
      department: 'EEE Department (Lead Architect)',
      status: 'active',
      isSuperAdmin: true
    });
  }

  return {
    superAdminEmail: CONFIG.SUPER_ADMIN.EMAIL,
    leadershipPresets: CONFIG.PRESET_LEADERSHIP,
    adminUsers: results
  };
}
