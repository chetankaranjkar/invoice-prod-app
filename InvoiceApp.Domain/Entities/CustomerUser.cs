namespace InvoiceApp.Domain.Entities
{
    /// <summary>
    /// Junction table: Customer shared with User. Admin can assign customers to users they manage.
    /// </summary>
    public class CustomerUser
    {
        public int CustomerId { get; set; }
        public Guid UserId { get; set; }

        public Customer? Customer { get; set; }
        public User? User { get; set; }
    }
}
