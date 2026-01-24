using AutoMapper;
using InvoiceApp.Domain.Entities;
using InvoiceApp.Application.DTOs;
using System;

namespace InvoiceApp.Application
{
    public class MappingProfile : Profile
    {
        public MappingProfile()
        {
            // Customer mappings
            CreateMap<Customer, CustomerProfileDto>();
            CreateMap<CreateCustomerDto, Customer>();

            // Invoice mappings
            CreateMap<Invoice, InvoiceDto>()
                .ForMember(dest => dest.CustomerName, opt => opt.MapFrom(src => src.Customer != null ? src.Customer.CustomerName : string.Empty))
                .ForMember(dest => dest.UserName, opt => opt.MapFrom(src => src.User != null ? src.User.Name : null))
                .ForMember(dest => dest.Items, opt => opt.MapFrom(src => src.InvoiceItems))
                .ForMember(dest => dest.Payments, opt => opt.MapFrom(src => src.Payments));

            CreateMap<InvoiceItem, InvoiceItemDto>();
            CreateMap<Payment, PaymentDto>();
            CreateMap<InvoiceItemDto, InvoiceItem>();
            CreateMap<PaymentDto, Payment>();

            CreateMap<User, UserProfileDto>()
                .ForMember(dest => dest.Role, opt => opt.MapFrom(src => src.Role ?? "User"));
            CreateMap<UpdateUserProfileDto, User>()
                .ForAllMembers(opts => opts.Condition((src, dest, srcMember) => srcMember != null));

            // AuditLog mappings
            CreateMap<AuditLog, AuditLogDto>();
            CreateMap<AuditLogDto, AuditLog>();

            // InvoiceTemplate mappings
            CreateMap<InvoiceTemplate, InvoiceTemplateDto>()
                .ForMember(dest => dest.Items, opt => opt.MapFrom(src => src.TemplateItems));
            CreateMap<InvoiceTemplateItem, InvoiceTemplateItemDto>();
            CreateMap<InvoiceTemplateItemDto, InvoiceTemplateItem>();
        }
    }
}