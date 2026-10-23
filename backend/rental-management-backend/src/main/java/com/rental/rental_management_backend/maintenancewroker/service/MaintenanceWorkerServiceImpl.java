package com.rental.rental_management_backend.maintenancewroker.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.maintenance.service.MaintenancePropertyAccessService;
import com.rental.rental_management_backend.maintenancewroker.entity.MaintenanceWorker;
import com.rental.rental_management_backend.maintenancewroker.entity.MaintenanceWorkerProperty;
import com.rental.rental_management_backend.maintenancewroker.dto.MaintenanceWorkerResponse;
import com.rental.rental_management_backend.maintenancewroker.repository.MaintenanceWorkerPropertyRepository;
import com.rental.rental_management_backend.maintenancewroker.repository.MaintenanceWorkerRepository;
import com.rental.rental_management_backend.property.entity.Property;

@Service
public class MaintenanceWorkerServiceImpl implements MaintenanceWorkerService {

    private final MaintenanceWorkerRepository repository;
    private final MaintenanceWorkerPropertyRepository workerPropertyRepository;
    private final MaintenancePropertyAccessService propertyAccessService;

    public MaintenanceWorkerServiceImpl(
            MaintenanceWorkerRepository repository,
            MaintenanceWorkerPropertyRepository workerPropertyRepository,
            MaintenancePropertyAccessService propertyAccessService) {
        this.repository = repository;
        this.workerPropertyRepository = workerPropertyRepository;
        this.propertyAccessService = propertyAccessService;
    }

    @Override
    @Transactional
    public MaintenanceWorkerResponse createWorker(MaintenanceWorker worker) {
        User user = propertyAccessService.getAuthenticatedUser();
        List<Long> propertyIds = worker.getPropertyIds();

        if (propertyIds == null || propertyIds.isEmpty()
                || propertyIds.stream().anyMatch(id -> id == null)) {
            throw new IllegalArgumentException(
                    "At least one valid property ID is required");
        }

        List<Property> properties = propertyIds.stream()
                .distinct()
                .map(id -> propertyAccessService.getAuthorizedProperty(user, id))
                .toList();

        if (worker.getAvailabilityStatus() == null
                || worker.getAvailabilityStatus().isBlank()) {
            worker.setAvailabilityStatus("AVAILABLE");
        }
        MaintenanceWorker savedWorker = repository.save(worker);
        List<MaintenanceWorkerProperty> mappings = new ArrayList<>();

        for (Property property : properties) {
            mappings.add(createMapping(savedWorker, property));
        }

        workerPropertyRepository.saveAll(mappings);
        savedWorker.setPropertyIds(properties.stream()
                .map(Property::getPropertyId)
                .toList());

        return MaintenanceWorkerResponse.from(savedWorker);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MaintenanceWorkerResponse> getAllWorkers() {
        User user = propertyAccessService.getAuthenticatedUser();

        if (user.getRole() == RoleType.SUPER_ADMIN) {
            return toResponses(attachPropertyIds(repository.findAll(), null));
        }

        Set<Long> authorizedPropertyIds =
                propertyAccessService.getAuthorizedPropertyIds(user);

        if (authorizedPropertyIds.isEmpty()) {
            return List.of();
        }

        List<MaintenanceWorkerProperty> mappings =
                workerPropertyRepository.findByProperty_PropertyIdIn(
                        authorizedPropertyIds);

        List<MaintenanceWorker> visibleWorkers = workersFromMappings(mappings);
        Set<Long> visibleWorkerIds = new HashSet<>();
        visibleWorkers.forEach(worker -> visibleWorkerIds.add(worker.getWorkerId()));
        Set<Long> linkedWorkerIds = new HashSet<>();
        workerPropertyRepository.findAll().forEach(mapping ->
                linkedWorkerIds.add(mapping.getWorker().getWorkerId()));

        // Let managers reuse existing technician records. Property IDs on the
        // response remain scoped to properties the manager is authorized for.
        repository.findAll().stream()
                .filter(worker -> !visibleWorkerIds.contains(worker.getWorkerId()))
                .filter(worker -> !linkedWorkerIds.contains(worker.getWorkerId())
                        || isAvailable(worker))
                .forEach(worker -> {
                    worker.setPropertyIds(List.of());
                    visibleWorkers.add(worker);
                });

        return toResponses(visibleWorkers);
    }

    @Override
    @Transactional(readOnly = true)
    public MaintenanceWorkerResponse getWorkerById(Long workerId) {
        return MaintenanceWorkerResponse.from(getAuthorizedWorker(workerId));
    }

    private MaintenanceWorker getAuthorizedWorker(Long workerId) {
        User user = propertyAccessService.getAuthenticatedUser();
        MaintenanceWorker worker = findWorker(workerId);
        List<MaintenanceWorkerProperty> mappings =
                workerPropertyRepository.findByWorker_WorkerId(workerId);

        if (user.getRole() != RoleType.SUPER_ADMIN) {
            boolean globallyUnassigned = mappings.isEmpty();
            Set<Long> authorizedPropertyIds =
                    propertyAccessService.getAuthorizedPropertyIds(user);

            mappings = mappings.stream()
                    .filter(mapping -> authorizedPropertyIds.contains(
                            mapping.getProperty().getPropertyId()))
                    .toList();

            if (mappings.isEmpty() && !globallyUnassigned) {
                throw new AccessDeniedException(
                        "You do not have access to this maintenance worker");
            }
        }

        worker.setPropertyIds(mappings.stream()
                .map(mapping -> mapping.getProperty().getPropertyId())
                .distinct()
                .toList());
        return worker;
    }

    @Override
    @Transactional
    public MaintenanceWorkerResponse updateWorker(
            Long workerId,
            MaintenanceWorker worker) {

        MaintenanceWorker existingWorker = getAuthorizedWorker(workerId);
        existingWorker.setName(worker.getName());
        existingWorker.setPhone(worker.getPhone());
        existingWorker.setEmail(worker.getEmail());
        existingWorker.setSpecialization(worker.getSpecialization());
        existingWorker.setAvailabilityStatus(
                worker.getAvailabilityStatus());

        MaintenanceWorker savedWorker = repository.save(existingWorker);
        savedWorker.setPropertyIds(existingWorker.getPropertyIds());
        return MaintenanceWorkerResponse.from(savedWorker);
    }

    @Override
    @Transactional
    public void deleteWorker(Long workerId) {
        User user = propertyAccessService.getAuthenticatedUser();
        MaintenanceWorker worker = findWorker(workerId);
        List<MaintenanceWorkerProperty> mappings =
                workerPropertyRepository.findByWorker_WorkerId(workerId);

        if (user.getRole() == RoleType.SUPER_ADMIN) {
            worker.setAvailabilityStatus("UNAVAILABLE");
            repository.save(worker);
            return;
        }

        if (user.getRole() != RoleType.SUPER_ADMIN) {
            Set<Long> authorizedPropertyIds =
                    propertyAccessService.getAuthorizedPropertyIds(user);

            List<MaintenanceWorkerProperty> managerMappings = mappings.stream()
                    .filter(mapping -> authorizedPropertyIds.contains(
                            mapping.getProperty().getPropertyId()))
                    .toList();
            if (managerMappings.isEmpty()) {
                throw new AccessDeniedException(
                        "You do not have access to remove this maintenance worker");
            }

            workerPropertyRepository.deleteAll(managerMappings);
            if (workerPropertyRepository.findByWorker_WorkerId(workerId).isEmpty()) {
                worker.setAvailabilityStatus("UNAVAILABLE");
            }
            repository.save(worker);
            return;
        }
    }

    @Override
    @Transactional
    public MaintenanceWorkerResponse associateWorkerWithProperty(
            Long workerId,
            Long propertyId) {

        User user = propertyAccessService.getAuthenticatedUser();
        MaintenanceWorker worker = findWorker(workerId);
        Property property =
                propertyAccessService.getAuthorizedProperty(user, propertyId);

        if (!workerPropertyRepository
                .existsByWorker_WorkerIdAndProperty_PropertyId(
                        workerId, propertyId)) {
            workerPropertyRepository.save(createMapping(worker, property));
        }

        return getWorkerById(workerId);
    }

    @Override
    @Transactional
    public MaintenanceWorkerResponse removeWorkerFromProperty(
            Long workerId,
            Long propertyId) {

        User user = propertyAccessService.getAuthenticatedUser();
        propertyAccessService.getAuthorizedProperty(user, propertyId);
        findWorker(workerId);

        if (!workerPropertyRepository
                .existsByWorker_WorkerIdAndProperty_PropertyId(
                        workerId, propertyId)) {
            throw new RuntimeException(
                    "Worker is not associated with property ID: "
                            + propertyId);
        }

        workerPropertyRepository.deleteByWorker_WorkerIdAndProperty_PropertyId(
                workerId, propertyId);

        MaintenanceWorker worker = findWorker(workerId);
        List<MaintenanceWorkerProperty> remainingMappings =
                workerPropertyRepository.findByWorker_WorkerId(workerId);
        if (remainingMappings.isEmpty()) {
            worker.setAvailabilityStatus("UNAVAILABLE");
            repository.save(worker);
        }
        if (user.getRole() != RoleType.SUPER_ADMIN) {
            Set<Long> authorizedPropertyIds =
                    propertyAccessService.getAuthorizedPropertyIds(user);
            remainingMappings = remainingMappings.stream()
                    .filter(mapping -> authorizedPropertyIds.contains(
                            mapping.getProperty().getPropertyId()))
                    .toList();
        }

        worker.setPropertyIds(remainingMappings.stream()
                .map(mapping -> mapping.getProperty().getPropertyId())
                .distinct()
                .toList());
        return MaintenanceWorkerResponse.from(worker);
    }

    private MaintenanceWorker findWorker(Long workerId) {
        return repository.findById(workerId)
                .orElseThrow(() -> new RuntimeException(
                        "Maintenance Worker not found with ID: " + workerId));
    }

    private boolean isAvailable(MaintenanceWorker worker) {
        String status = worker.getAvailabilityStatus();
        return status == null || !("UNAVAILABLE".equalsIgnoreCase(status)
                || "INACTIVE".equalsIgnoreCase(status)
                || "NOT_AVAILABLE".equalsIgnoreCase(status));
    }

    private MaintenanceWorkerProperty createMapping(
            MaintenanceWorker worker,
            Property property) {
        MaintenanceWorkerProperty mapping =
                new MaintenanceWorkerProperty();
        mapping.setWorker(worker);
        mapping.setProperty(property);
        return mapping;
    }

    private List<MaintenanceWorker> workersFromMappings(
            List<MaintenanceWorkerProperty> mappings) {
        Map<Long, MaintenanceWorker> workers = new LinkedHashMap<>();
        Map<Long, List<Long>> propertyIdsByWorker = new LinkedHashMap<>();

        for (MaintenanceWorkerProperty mapping : mappings) {
            Long workerId = mapping.getWorker().getWorkerId();
            workers.putIfAbsent(workerId, mapping.getWorker());
            propertyIdsByWorker.computeIfAbsent(
                    workerId, ignored -> new ArrayList<>())
                    .add(mapping.getProperty().getPropertyId());
        }

        workers.forEach((workerId, worker) ->
                worker.setPropertyIds(propertyIdsByWorker.get(workerId)
                        .stream()
                        .distinct()
                        .toList()));

        return new ArrayList<>(workers.values());
    }

    private List<MaintenanceWorker> attachPropertyIds(
            List<MaintenanceWorker> workers,
            Set<Long> propertyScope) {
        Map<Long, MaintenanceWorker> workersById = new LinkedHashMap<>();
        workers.forEach(worker -> workersById.put(
                worker.getWorkerId(), worker));

        if (workers.isEmpty()) {
            return workers;
        }

        List<MaintenanceWorkerProperty> mappings = propertyScope == null
                ? workerPropertyRepository.findAll()
                : workerPropertyRepository.findByProperty_PropertyIdIn(
                        propertyScope);

        for (MaintenanceWorkerProperty mapping : mappings) {
            Long workerId = mapping.getWorker().getWorkerId();
            MaintenanceWorker worker = workersById.get(workerId);
            if (worker != null) {
                if (worker.getPropertyIds() == null) {
                    worker.setPropertyIds(new ArrayList<>());
                }
                worker.getPropertyIds().add(
                        mapping.getProperty().getPropertyId());
            }
        }

        workers.forEach(worker -> {
            List<Long> ids = worker.getPropertyIds();
            worker.setPropertyIds(ids == null
                    ? List.of()
                    : ids.stream().distinct().toList());
        });

        return workers;
    }

    private List<MaintenanceWorkerResponse> toResponses(
            List<MaintenanceWorker> workers) {
        return workers.stream()
                .map(MaintenanceWorkerResponse::from)
                .toList();
    }
}
