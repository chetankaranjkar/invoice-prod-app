using AutoMapper;
using InvoiceApp.Application.DTOs;
using InvoiceApp.Application.Interfaces;
using InvoiceApp.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace InvoiceApp.Api.Controllers
{
   
    [Authorize]
    public class CustomersController : BaseController
    {
        private readonly ICustomerRepository _customerRepository;
        private readonly IUserContext _userContext;
        private readonly IMapper _mapper;

        public CustomersController(
            ICustomerRepository customerRepository,
            IUserContext userContext,
            IMapper mapper)
        {
            _customerRepository = customerRepository;
            _userContext = userContext;
            _mapper = mapper;
        }

        [HttpGet]
        public async Task<ActionResult<List<CustomerDto>>> GetCustomers()
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User not authenticated");

            var customers = await _customerRepository.GetByUserIdAsync(userId.Value);
            var customerDtos = _mapper.Map<List<CustomerDto>>(customers);
            return Ok(customerDtos);
        }

        [HttpPost]
        public async Task<ActionResult<CustomerDto>> CreateCustomer(CreateCustomerDto createCustomerDto)
        {
            var userId = _userContext.GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User not authenticated");

            var customer = _mapper.Map<Customer>(createCustomerDto);
            customer.UserId = userId.Value;

            var createdCustomer = await _customerRepository.AddAsync(customer);
            var customerDto = _mapper.Map<CustomerDto>(createdCustomer);

            return CreatedAtAction(nameof(GetCustomers), customerDto);
        }
    }
}