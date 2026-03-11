using AutoMapper;
using InvoiceApp.Domain.Entities;
using InvoiceApp.Application.DTOs;
using InvoiceApp.Application.Resolvers;
using System;

namespace InvoiceApp.Application
{
    public class MappingProfile : Profile
    {
        public MappingProfile()
        {
            // Customer mappings - IsSharedWithMe and SharedWithUserIds set in repository
            CreateMap<Customer, CustomerProfileDto>()
                .ForMember(dest => dest.UserName, opt => opt.MapFrom(src => src.User != null ? src.User.Name : null))
                .ForMember(dest => dest.UserEmail, opt => opt.MapFrom(src => src.User != null ? src.User.Email : null))
                .ForMember(dest => dest.IsSharedWithMe, opt => opt.Ignore())
                .ForMember(dest => dest.SharedWithUserIds, opt => opt.Ignore());
            CreateMap<CreateCustomerDto, Customer>()
                .ForMember(dest => dest.SharedWithUsers, opt => opt.Ignore());

            // Invoice mappings - SellerInfo from snapshot (at creation) or fallback to User
            CreateMap<Invoice, InvoiceDto>()
                .ForMember(dest => dest.CustomerName, opt => opt.MapFrom(src => src.Customer != null ? src.Customer.CustomerName : string.Empty))
                .ForMember(dest => dest.UserId, opt => opt.MapFrom(src => src.UserId))
                .ForMember(dest => dest.UserName, opt => opt.MapFrom(src => src.User != null ? src.User.Name : null))
                .ForMember(dest => dest.SellerInfo, opt => opt.MapFrom<InvoiceSellerInfoResolver>())
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