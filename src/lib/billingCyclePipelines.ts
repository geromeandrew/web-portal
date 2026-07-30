export type BillingCyclePipeline = {
  label: string;
  code: string;
};

export const billingCyclePipelines: readonly BillingCyclePipeline[] = [
  { label: "BSS Bill Cycles - Globe", code: "bss_billcycle_glob" },
  { label: "BSS Bill Cycles - Innove", code: "bss_billcycle_inov" },
  { label: "BSS Bill Cycles - Bayan", code: "bss_billcycle_bayn" },
  { label: "BSS EOM - Globe", code: "bss_eom_glob" },
  { label: "BSS EOM - Innove", code: "bss_eom_inov" },
  { label: "BSS EOM - Bayan", code: "bss_eom_bayn" },
  { label: "Memo Standard Template", code: "memo_sst" },
  { label: "ICCBS - Innove", code: "iccbs_inov" },
  { label: "ICCBS - Bayan", code: "iccbs_bayn" },
  { label: "APRM Voice - Accrual", code: "aprm_voice_accrual" },
  { label: "APRM Voice - Delta", code: "aprm_voice_delta" },
  { label: "ISMS IBOB Actualization", code: "isms_ibob_actzn" },
  { label: "ISMS IOT Discount", code: "isms_iot_da" },
  { label: "North", code: "north" },
  { label: "Prepaid Reclass", code: "prepaid_reclass" },
];
