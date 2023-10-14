// Helper function to sort feed items by date and id.
export const sortFeedItems = (a, b) => {
    const dateA = new Date(a.date).setHours(0, 0, 0, 0);
    const dateB = new Date(b.date).setHours(0, 0, 0, 0);

    if (dateA < dateB) return 1;
    if (dateA > dateB) return -1;

    return b.id - a.id;
};

// Helper function to sort merged URL titles.
export const sortMergedUrls = (a, b) => {
    const titleA = a.title.toLowerCase().split(' ').join('-');
    const titleB = b.title.toLowerCase().split(' ').join('-');

    return titleA.localeCompare(titleB);
};