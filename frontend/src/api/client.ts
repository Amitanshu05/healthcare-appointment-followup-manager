export const apiClient = {
    get: async (url: string) => {
        const res = await fetch(url);
        return res.json();
    }
};
