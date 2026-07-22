export type AppRole =
  | "super_admin"
  | "clinic_admin"
  | "branch_admin"
  | "doctor"
  | "junior_doctor"
  | "senior_doctor"
  | "manager"
  | "junior"
  | "receptionist"
  | "lab_technician"
  | "pharmacist"
  | "pet_owner";

export type NavItem = { href: string; label: string };
export type NavGroup = { title: string; items: NavItem[] };

export function roleCanGenerateQr(
  role: AppRole,
  isSuperAdmin: boolean
): { clinicSelectable: boolean; allowedRoles: AppRole[] } {
  if (isSuperAdmin) {
    return {
      clinicSelectable: true,
      allowedRoles: [
        "clinic_admin",
        "branch_admin",
        "doctor",
        "junior_doctor",
        "senior_doctor",
        "manager",
        "junior",
        "receptionist",
        "lab_technician",
        "pharmacist",
        "pet_owner",
      ],
    };
  }
  if (role === "clinic_admin") {
    return {
      clinicSelectable: false,
      allowedRoles: [
        "branch_admin",
        "doctor",
        "junior_doctor",
        "senior_doctor",
        "manager",
        "junior",
        "receptionist",
        "lab_technician",
        "pharmacist",
      ],
    };
  }
  if (role === "receptionist" || role === "doctor" || role === "junior_doctor" || role === "senior_doctor") {
    return { clinicSelectable: false, allowedRoles: ["pet_owner"] };
  }
  return { clinicSelectable: false, allowedRoles: [] };
}

/** Grouped sidebar navigation (preferred). */
export function getRoleNavGroups(role: AppRole, isSuperAdmin: boolean): NavGroup[] {
  if (isSuperAdmin) {
    return [
      {
        title: "Overview",
        items: [{ href: "/dashboard", label: "Dashboard" }],
      },
        {
          title: "Platform",
          items: [
            { href: "/super-admin", label: "Platform control" },
            { href: "/super-admin/users", label: "Users & roles" },
            { href: "/super-admin/reports", label: "Global reports" },
            { href: "/invite-qrs", label: "Clinic onboarding QR" },
          ],
        },
      {
        title: "Patients & care",
        items: [
          { href: "/owners", label: "Owners" },
          { href: "/pets", label: "Pets" },
          { href: "/reception/walk-in", label: "Walk-in guest" },
          { href: "/appointments", label: "Appointments" },
          { href: "/appointments/calendar", label: "Calendar" },
          { href: "/appointments/availability", label: "Doctor availability" },
          { href: "/vaccinations", label: "Vaccinations" },
          { href: "/settings/online-consult", label: "Senior Vet online consult" },
          { href: "/medical-records", label: "Medical records" },
          { href: "/medicines", label: "Medicine catalog" },
        ],
      },
      {
        title: "Commerce & billing",
        items: [
          { href: "/inventory", label: "Inventory" },
          { href: "/ecommerce", label: "Ecommerce" },
          { href: "/payments", label: "Payments" },
          { href: "/invoices", label: "Invoices" },
          { href: "/clinic-profile/invoice-template", label: "Invoice PDF template" },
        ],
      },
      {
        title: "Content",
        items: [
          { href: "/blog", label: "Blog CMS" },
          { href: "/services", label: "Services CMS" },
        ],
      },
        {
          title: "Insights",
          items: [
            { href: "/analytics", label: "Analytics" },
            { href: "/notifications-center", label: "Notifications" },
            { href: "/announcements", label: "Announcements" },
          ],
        },
      {
        title: "Clinic setup",
        items: [
          { href: "/clinic-profile", label: "Clinic profile" },
          { href: "/branches", label: "Branches" },
        ],
      },
    ];
  }

  const base: NavGroup = {
    title: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard" }],
  };

  switch (role) {
    case "clinic_admin":
      return [
        base,
        {
          title: "Team & patients",
          items: [
            { href: "/branches", label: "Branches" },
            { href: "/owners", label: "Owners" },
            { href: "/pets", label: "Pets" },
            { href: "/reception/walk-in", label: "Walk-in guest" },
          ],
        },
        {
          title: "Scheduling",
          items: [
            { href: "/appointments", label: "Appointments" },
            { href: "/appointments/calendar", label: "Calendar" },
            { href: "/appointments/availability", label: "Doctor availability" },
            { href: "/vaccinations", label: "Vaccinations" },
            { href: "/medicines", label: "Medicine catalog" },
          ],
        },
        {
          title: "Commerce",
          items: [
            { href: "/inventory", label: "Inventory" },
            { href: "/ecommerce", label: "Ecommerce" },
            { href: "/payments", label: "Payments" },
            { href: "/invoices", label: "Invoices" },
            { href: "/clinic-profile/invoice-template", label: "Invoice PDF template" },
          ],
        },
        {
          title: "Growth & content",
          items: [
            { href: "/analytics", label: "Analytics" },
            { href: "/blog", label: "Blog CMS" },
            { href: "/services", label: "Services CMS" },
          ],
        },
        {
          title: "Clinic",
          items: [
            { href: "/clinic-profile", label: "Clinic profile" },
            { href: "/settings/online-consult", label: "Senior Vet online consult" },
            { href: "/team", label: "Team & roles" },
            { href: "/invite-qrs", label: "Staff QR invites" },
            { href: "/announcements", label: "Announcements" },
          ],
        },
      ];
    /** Clinic membership role `super_admin` (not platform-wide `isSuperAdmin` nav). */
    case "super_admin":
      return getRoleNavGroups("clinic_admin", false);
    case "branch_admin":
      return [
        base,
        {
          title: "Patients & directory",
          items: [
            { href: "/owners", label: "Owners" },
            { href: "/pets", label: "Pets" },
            { href: "/reception/walk-in", label: "Walk-in guest" },
          ],
        },
        {
          title: "Scheduling",
          items: [
            { href: "/appointments", label: "Appointments" },
            { href: "/appointments/calendar", label: "Calendar" },
          ],
        },
        {
          title: "Operations",
          items: [
            { href: "/inventory", label: "Inventory" },
            { href: "/medicines", label: "Medicine catalog" },
            { href: "/ecommerce", label: "Store orders" },
            { href: "/invoices", label: "Invoices" },
            { href: "/billing/branch-portal", label: "Branch web access" },
            { href: "/clinic-profile/invoice-template", label: "Invoice PDF template" },
            { href: "/analytics", label: "Analytics" },
            { href: "/invite-qrs", label: "Clinic onboarding QR" },
            { href: "/announcements", label: "Announcements" },
          ],
        },
      ];
    case "doctor":
    case "junior_doctor":
    case "senior_doctor":
      return [
        base,
        {
          title: "Clinical",
          items: [
            { href: "/owners", label: "Owners" },
            { href: "/pets", label: "Pets" },
            { href: "/reception/walk-in", label: "Walk-in guest" },
            { href: "/appointments", label: "Appointments" },
            { href: "/medical-records", label: "Medical records" },
            { href: "/medicines", label: "Medicine catalog" },
            { href: "/notifications-center", label: "Notifications" },
          ],
        },
        {
          title: "Doctor tools",
          items: [{ href: "/doctor/phone-camera", label: "Phone camera" }],
        },
        {
          title: "Onboarding",
          items: [{ href: "/invite-qrs", label: "Clinic onboarding QR" }],
        },
      ];
    case "manager":
    case "junior":
      return [
        base,
        {
          title: "Clinical records",
          items: [
            { href: "/owners", label: "Owners" },
            { href: "/pets", label: "Pets" },
            { href: "/appointments", label: "Appointments" },
            { href: "/medical-records", label: "Medical records" },
            { href: "/medicines", label: "Medicine catalog" },
            { href: "/notifications-center", label: "Notifications" },
          ],
        },
      ];
    case "receptionist":
      return [
        base,
        {
          title: "Front desk",
          items: [
            { href: "/reception/walk-in", label: "Walk-in guest" },
            { href: "/owners", label: "Owners" },
            { href: "/pets", label: "Pets" },
            { href: "/appointments", label: "Appointments" },
            { href: "/invoices", label: "Invoices" },
            { href: "/payments", label: "Payments" },
          ],
        },
        {
          title: "Onboarding",
          items: [{ href: "/invite-qrs", label: "Pet owner QR invites" }],
        },
      ];
    case "lab_technician":
      return [
        base,
        {
          title: "Lab",
          items: [{ href: "/medical-records", label: "Lab reports" }],
        },
      ];
    case "pharmacist":
      return [
        base,
        {
          title: "Pharmacy",
          items: [{ href: "/inventory", label: "Inventory" }],
        },
      ];
    case "pet_owner":
      return [base];
    default:
      return [base];
  }
}

/** @deprecated Prefer getRoleNavGroups for grouped navigation */
export function getRoleModules(role: AppRole, isSuperAdmin: boolean): NavItem[] {
  return getRoleNavGroups(role, isSuperAdmin).flatMap((g) => g.items);
}
