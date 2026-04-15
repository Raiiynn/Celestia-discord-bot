const supabase = require('./db');

class ExpiringDocumentManager {
  constructor(tableName, expiresField, onExpire) {
    this.tableName = tableName;
    this.expiresField = expiresField;
    this.onExpire = onExpire;
    this.checkInterval = 60000;
  }

  startExpiration() {
    console.log(`[ExpiringDocumentManager] Starting expiration check for ${this.tableName}`);
    this.checkExpiredDocuments();
  }

  async checkExpiredDocuments() {
    try {
      const now = Date.now();

      const { data: expiredDocs, error } = await supabase
        .from(this.tableName)
        .select('*')
        .lte(this.expiresField, now);

      if (error) {
        console.error(`[ExpiringDocumentManager] Error fetching expired documents:`, error);
        return;
      }

      if (expiredDocs && expiredDocs.length > 0) {
        console.log(`[ExpiringDocumentManager] Found ${expiredDocs.length} expired documents in ${this.tableName}`);

        for (const doc of expiredDocs) {
          try {
            if (this.onExpire) {
              await this.onExpire(doc);
            }

            const { error: deleteError } = await supabase
              .from(this.tableName)
              .delete()
              .eq('id', doc.id);

            if (deleteError) {
              console.error(`[ExpiringDocumentManager] Error deleting document:`, deleteError);
            }
          } catch (err) {
            console.error(`[ExpiringDocumentManager] Error processing document:`, err);
          }
        }
      }
    } catch (error) {
      console.error(`[ExpiringDocumentManager] Fatal error:`, error);
    }

    setTimeout(() => this.checkExpiredDocuments(), this.checkInterval);
  }

  stopExpiration() {
    console.log(`[ExpiringDocumentManager] Stopping expiration check for ${this.tableName}`);
  }
}

module.exports = ExpiringDocumentManager;
