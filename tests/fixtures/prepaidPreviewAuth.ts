export const useAuth = () => ({
  user: {
    displayName: "Juan Miguel Dela Cruz",
    email: "preview@example.test",
    isAdmin: true,
    modules: [{ moduleId: "prepaid_reclass" }],
  },
  logout: async () => undefined,
});
