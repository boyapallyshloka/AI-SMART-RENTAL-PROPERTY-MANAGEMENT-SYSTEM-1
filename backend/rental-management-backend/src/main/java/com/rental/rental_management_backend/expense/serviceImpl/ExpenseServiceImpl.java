package com.rental.rental_management_backend.expense.serviceImpl;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.expense.dto.ExpenseCreateRequest;
import com.rental.rental_management_backend.expense.dto.ExpenseResponse;
import com.rental.rental_management_backend.expense.dto.ExpenseUpdateRequest;
import com.rental.rental_management_backend.expense.entity.Expense;
import com.rental.rental_management_backend.expense.repository.ExpenseRepository;
import com.rental.rental_management_backend.expense.service.ExpenseService;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.PropertyManager;
import com.rental.rental_management_backend.property.repository.PropertyManagerRepository;
import com.rental.rental_management_backend.property.repository.PropertyRepository;

@Service
public class ExpenseServiceImpl implements ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final PropertyManagerRepository propertyManagerRepository;

    private static final String IMAGE_DIRECTORY = "uploads/expense-images/";

    public ExpenseServiceImpl(
            ExpenseRepository expenseRepository,
            PropertyRepository propertyRepository,
            UserRepository userRepository,
            PropertyManagerRepository propertyManagerRepository) {

        this.expenseRepository = expenseRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.propertyManagerRepository = propertyManagerRepository;
    }

    // =========================================================
    // CREATE EXPENSE
    // =========================================================

    @Override
    @Transactional
    public ExpenseResponse createExpense(
            ExpenseCreateRequest request,
            MultipartFile image) {

        Property property = propertyRepository.findById(request.getPropertyId())
                .orElseThrow(() ->
                        new RuntimeException("Property not found"));

        // Check whether the logged-in user can access this property
        checkPropertyAccess(property);

        Expense expense = new Expense();

        expense.setProperty(property);
        expense.setCategory(request.getCategory());
        expense.setDescription(request.getDescription());
        expense.setAmount(request.getAmount());
        expense.setExpenseDate(request.getExpenseDate());

        // Save image if provided
        if (image != null && !image.isEmpty()) {

            String imagePath = saveImage(image);

            expense.setImagePath(imagePath);

        } else {

            expense.setImagePath(null);
        }

        Expense savedExpense = expenseRepository.save(expense);

        return mapToResponse(savedExpense);
    }

    // =========================================================
    // GET SINGLE EXPENSE
    // =========================================================

    @Override
    public ExpenseResponse getExpense(Long expenseId) {

        Expense expense = expenseRepository.findById(expenseId)
                .orElseThrow(() ->
                        new RuntimeException("Expense not found"));

        // Check access to the property that owns this expense
        checkPropertyAccess(expense.getProperty());

        return mapToResponse(expense);
    }

    // =========================================================
    // GET ALL EXPENSES FOR A PROPERTY
    // =========================================================

    @Override
    public List<ExpenseResponse> getExpensesByProperty(Long propertyId) {

        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() ->
                        new RuntimeException("Property not found"));

        // Check access to this property
        checkPropertyAccess(property);

        return expenseRepository
                .findByProperty_PropertyId(propertyId)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // =========================================================
    // UPDATE EXPENSE
    // =========================================================

    @Override
    @Transactional
    public ExpenseResponse updateExpense(
            Long expenseId,
            ExpenseUpdateRequest request) {

        Expense expense = expenseRepository.findById(expenseId)
                .orElseThrow(() ->
                        new RuntimeException("Expense not found"));

        /*
         * First check access to the property's current expense.
         */
        checkPropertyAccess(expense.getProperty());

        /*
         * If propertyId is being changed, check access to the
         * new property as well.
         */
        if (request.getPropertyId() != null) {

            Property property = propertyRepository
                    .findById(request.getPropertyId())
                    .orElseThrow(() ->
                            new RuntimeException("Property not found"));

            // Check whether logged-in user can access new property
            checkPropertyAccess(property);

            expense.setProperty(property);
        }

        if (request.getCategory() != null) {
            expense.setCategory(request.getCategory());
        }

        if (request.getDescription() != null) {
            expense.setDescription(request.getDescription());
        }

        if (request.getAmount() != null) {
            expense.setAmount(request.getAmount());
        }

        if (request.getExpenseDate() != null) {
            expense.setExpenseDate(request.getExpenseDate());
        }

        Expense updatedExpense = expenseRepository.save(expense);

        return mapToResponse(updatedExpense);
    }

    // =========================================================
    // DELETE EXPENSE
    // =========================================================

    @Override
    @Transactional
    public void deleteExpense(Long expenseId) {

        Expense expense = expenseRepository.findById(expenseId)
                .orElseThrow(() ->
                        new RuntimeException("Expense not found"));

        // Check property access before deleting
        checkPropertyAccess(expense.getProperty());

        expenseRepository.delete(expense);
    }

    // =========================================================
    // PROPERTY ACCESS AUTHORIZATION
    // =========================================================

    private void checkPropertyAccess(Property property) {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (authentication == null ||
                !authentication.isAuthenticated()) {

            throw new RuntimeException("User is not authenticated");
        }

        /*
         * JWT authentication normally stores the user's email
         * as the authentication name.
         */
        String email = authentication.getName();

        User loggedInUser = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException("Logged-in user not found"));

        RoleType role = loggedInUser.getRole();

        // =====================================================
        // SUPER ADMIN
        // =====================================================

        if (role == RoleType.SUPER_ADMIN) {

            // SUPER_ADMIN can access every property
            return;
        }

        // =====================================================
        // PROPERTY OWNER
        // =====================================================

        if (role == RoleType.PROPERTY_OWNER) {

            User propertyOwner = property.getOwner();

            if (propertyOwner == null ||
                    !propertyOwner.getId().equals(loggedInUser.getId())) {

                throw new RuntimeException(
                        "You do not have access to this property");
            }

            return;
        }

        // =====================================================
        // PROPERTY MANAGER
        // =====================================================

        if (role == RoleType.PROPERTY_MANAGER) {

            PropertyManager propertyManager =
                    property.getPropertyManager();

            if (propertyManager == null) {

                throw new RuntimeException(
                        "This property is not assigned to a manager");
            }

            PropertyManager loggedInManager =
                    propertyManagerRepository
                            .findByUser(loggedInUser)
                            .orElseThrow(() ->
                                    new RuntimeException(
                                            "Property manager record not found"));

            if (!propertyManager.getPropertyManagerId()
                    .equals(loggedInManager.getPropertyManagerId())) {

                throw new RuntimeException(
                        "You do not have access to this property");
            }

            return;
        }

        // =====================================================
        // OTHER ROLES
        // =====================================================

        throw new RuntimeException(
                "You do not have permission to access expenses");
    }

    // =========================================================
    // SAVE EXPENSE IMAGE
    // =========================================================

    private String saveImage(MultipartFile image) {

        try {

            Path directory = Paths.get(IMAGE_DIRECTORY);

            if (!Files.exists(directory)) {
                Files.createDirectories(directory);
            }

            String originalName = image.getOriginalFilename();

            String extension = "";

            if (originalName != null &&
                    originalName.contains(".")) {

                extension = originalName.substring(
                        originalName.lastIndexOf("."));
            }

            String fileName =
                    UUID.randomUUID() + extension;

            Path filePath =
                    directory.resolve(fileName);

            Files.copy(
                    image.getInputStream(),
                    filePath);

            return filePath.toString();

        } catch (IOException e) {

            throw new RuntimeException(
                    "Failed to save expense image",
                    e);
        }
    }

    // =========================================================
    // MAP ENTITY → RESPONSE
    // =========================================================

    private ExpenseResponse mapToResponse(
            Expense expense) {

        ExpenseResponse response =
                new ExpenseResponse();

        response.setExpenseId(
                expense.getExpenseId());

        response.setPropertyId(
                expense.getProperty()
                        .getPropertyId());

        response.setCategory(
                expense.getCategory());

        response.setDescription(
                expense.getDescription());

        response.setAmount(
                expense.getAmount());

        response.setExpenseDate(
                expense.getExpenseDate());

        response.setImagePath(
                expense.getImagePath());

        response.setCreatedAt(
                expense.getCreatedAt());

        return response;
    }
}