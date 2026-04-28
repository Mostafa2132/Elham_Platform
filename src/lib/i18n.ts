import { locales } from "@/data/translations";
import { type Locale } from "@/types";

export const isLocale = (value: string): value is Locale => locales.includes(value as Locale);
export const getDirection = (locale: Locale) => (locale === "ar" ? "rtl" : "ltr");
