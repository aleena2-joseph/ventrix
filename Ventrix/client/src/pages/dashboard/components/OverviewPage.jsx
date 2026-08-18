import React from "react";
import { useAuth } from "../../../context/AuthContext";
import AdminOverview from "./AdminOverview";
import EngineerOverview from "./EngineerOverview";
import TechnicianOverview from "./TechnicianOverview";

export default function OverviewPage(props) {
  const { role } = useAuth();
  const normalizedRole = (role || "").toUpperCase();

  if (normalizedRole === "TECHNICIAN") {
    return <TechnicianOverview {...props} />;
  }

  if (normalizedRole === "ENGINEER") {
    return <EngineerOverview {...props} />;
  }

  // Admin Overview (for ADMIN, VENTRIX_ADMIN, SUPER_ADMIN, etc.)
  return <AdminOverview {...props} />;
}
