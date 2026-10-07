export const launchConfig = {
  platform: {
    landlordListingFeeKSh: 0,
    tenantBrowsingFeeKSh: 0,
    viewingRequestFeeKSh: 0,
    landlordSubscriptionFeeKSh: 0,
    mandatoryPlatformPaymentsEnabled: false,
  },
  labels: {
    demoData: "Demo listing",
    demoVerification: "Demo verification",
    freeLaunch: "Free launch configuration",
  },
  futurePricingPolicy: {
    freeIntroductoryPeriod: true,
    paidListingPeriodsEnabled: false,
    listingExpiryDays: 0,
    gracePeriodDays: 0,
    renewalRequired: false,
  },
  platformNotes: {
    noMpesasRequired: true,
    noPaymentWallOnCoreFeatures: true,
    allLaunchFeaturesFree: true,
  },
} as const;

export type PricingConfig = typeof launchConfig;

export const freeLaunchSummary = [
  "Landlord listings: free",
  "Tenant browsing: free",
  "Viewing requests: free",
  "Mandatory platform payments: disabled",
  "M-Pesa simulation: disabled",
].join(" • ");
